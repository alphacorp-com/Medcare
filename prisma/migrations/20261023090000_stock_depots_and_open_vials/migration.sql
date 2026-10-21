-- Stock per depot (lots and movements carry their storage location, transfers between
-- depots), multi-dose vials, and the dispensing depot of every article.

-- AlterEnum (the new values are not used in this migration)
ALTER TYPE "tenant_template"."StockMovementType" ADD VALUE 'transfer_out';
ALTER TYPE "tenant_template"."StockMovementType" ADD VALUE 'transfer_in';

-- AlterTable
ALTER TABLE "tenant_template"."medication_inventory" ADD COLUMN     "doses_per_unit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "open_vial_hours" INTEGER;

ALTER TABLE "tenant_template"."medication_inventory" ADD CONSTRAINT "medication_inventory_doses_per_unit_positive" CHECK ("doses_per_unit" >= 1);
ALTER TABLE "tenant_template"."medication_inventory" ADD CONSTRAINT "medication_inventory_open_vial_hours_positive" CHECK ("open_vial_hours" IS NULL OR "open_vial_hours" >= 1);

-- ── Dispensing depot of every article ─────────────────────────────────────────
-- Articles without a storage location get the tenant's "PRINCIPAL" depot, created when
-- missing (lib/stock/locations.ts uses the same code).
INSERT INTO "tenant_template"."storage_locations" ("id", "tenant_id", "code", "name", "updated_at")
SELECT gen_random_uuid(), t."tenant_id", 'PRINCIPAL', 'Dépôt principal', CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT i."tenant_id"
  FROM "tenant_template"."medication_inventory" i
  WHERE i."tenant_id" IS NOT NULL AND i."storage_location_id" IS NULL
) t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_template"."storage_locations" l WHERE l."tenant_id" = t."tenant_id" AND l."code" = 'PRINCIPAL'
);

UPDATE "tenant_template"."medication_inventory" i
SET "storage_location_id" = l."id"
FROM "tenant_template"."storage_locations" l
WHERE i."storage_location_id" IS NULL AND i."tenant_id" IS NOT NULL
  AND l."tenant_id" = i."tenant_id" AND l."code" = 'PRINCIPAL';

-- ── Lots and movements: existing ones are in their article's depot ───────────
ALTER TABLE "tenant_template"."stock_lots" ADD COLUMN "location_id" UUID;
ALTER TABLE "tenant_template"."stock_movements" ADD COLUMN "location_id" UUID;

UPDATE "tenant_template"."stock_lots" s
SET "location_id" = i."storage_location_id"
FROM "tenant_template"."medication_inventory" i
WHERE i."id" = s."item_id";

UPDATE "tenant_template"."stock_movements" m
SET "location_id" = i."storage_location_id"
FROM "tenant_template"."medication_inventory" i
WHERE i."id" = m."item_id";

ALTER TABLE "tenant_template"."stock_lots" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "tenant_template"."stock_movements" ALTER COLUMN "location_id" SET NOT NULL;

-- DropIndex / CreateIndex: a lot number is unique per article AND depot
DROP INDEX "tenant_template"."stock_lots_item_id_lot_number_key";
CREATE UNIQUE INDEX "stock_lots_item_id_lot_number_location_id_key" ON "tenant_template"."stock_lots"("item_id", "lot_number", "location_id");

-- AlterTable
ALTER TABLE "tenant_template"."immunizations" ADD COLUMN     "stock_open_vial_id" UUID;

-- CreateTable
CREATE TABLE "tenant_template"."stock_open_vials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "doses_per_vial" INTEGER NOT NULL,
    "doses_used" INTEGER NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMPTZ NOT NULL,
    "discard_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "closed_reason" VARCHAR(20),
    "opened_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_open_vials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_open_vials_doses_valid" CHECK ("doses_used" >= 0 AND "doses_used" <= "doses_per_vial" AND "doses_per_vial" >= 1)
);

-- CreateIndex
CREATE INDEX "stock_open_vials_tenant_id_lot_id_closed_at_idx" ON "tenant_template"."stock_open_vials"("tenant_id", "lot_id", "closed_at");

-- CreateIndex
CREATE INDEX "stock_open_vials_tenant_id_opened_at_idx" ON "tenant_template"."stock_open_vials"("tenant_id", "opened_at");

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_lots" ADD CONSTRAINT "stock_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "tenant_template"."storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "tenant_template"."storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_open_vials" ADD CONSTRAINT "stock_open_vials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "tenant_template"."medication_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_open_vials" ADD CONSTRAINT "stock_open_vials_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "tenant_template"."stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."immunizations" ADD CONSTRAINT "immunizations_stock_open_vial_id_fkey" FOREIGN KEY ("stock_open_vial_id") REFERENCES "tenant_template"."stock_open_vials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
