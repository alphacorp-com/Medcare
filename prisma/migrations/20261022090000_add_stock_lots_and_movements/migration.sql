-- CreateEnum
CREATE TYPE "tenant_template"."StockMovementType" AS ENUM ('opening_balance', 'receipt', 'dispensing', 'vaccination', 'expired', 'damaged', 'lost', 'adjustment');

-- AlterTable
ALTER TABLE "tenant_template"."medication_inventory" ADD COLUMN     "rma3_category" VARCHAR(30),
ADD COLUMN     "vaccine_antigen_code" VARCHAR(40);

-- AlterTable
ALTER TABLE "tenant_template"."immunizations" ADD COLUMN     "stock_lot_id" UUID;

-- CreateTable
CREATE TABLE "tenant_template"."stock_lots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_number" VARCHAR(60) NOT NULL,
    "expiry_date" DATE,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID,
    "type" "tenant_template"."StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "source_type" VARCHAR(40),
    "source_id" UUID,
    "supplier_id" UUID,
    "unit_cost" DECIMAL(12,2),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_lots_tenant_id_expiry_date_idx" ON "tenant_template"."stock_lots"("tenant_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_item_id_lot_number_key" ON "tenant_template"."stock_lots"("item_id", "lot_number");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_item_id_occurred_at_idx" ON "tenant_template"."stock_movements"("tenant_id", "item_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_occurred_at_idx" ON "tenant_template"."stock_movements"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_source_type_source_id_idx" ON "tenant_template"."stock_movements"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "medication_inventory_tenant_id_vaccine_antigen_code_idx" ON "tenant_template"."medication_inventory"("tenant_id", "vaccine_antigen_code");

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_lots" ADD CONSTRAINT "stock_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "tenant_template"."medication_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "tenant_template"."medication_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "tenant_template"."stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."immunizations" ADD CONSTRAINT "immunizations_stock_lot_id_fkey" FOREIGN KEY ("stock_lot_id") REFERENCES "tenant_template"."stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Integrity (defence in depth: lib/stock never lets these go negative) ────────
-- A negative stock is physically impossible: it can only come from the former direct
-- edits of medication_inventory.stock, so it is reset to 0 before the constraints.
UPDATE "tenant_template"."medication_inventory" SET "stock" = 0 WHERE "stock" < 0;

ALTER TABLE "tenant_template"."medication_inventory" ADD CONSTRAINT "medication_inventory_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "tenant_template"."stock_lots" ADD CONSTRAINT "stock_lots_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_quantity_non_zero" CHECK ("quantity" <> 0);
ALTER TABLE "tenant_template"."stock_movements" ADD CONSTRAINT "stock_movements_balance_non_negative" CHECK ("balance_after" >= 0);

-- ── Opening balance ───────────────────────────────────────────────────────────
-- The current stock of each article becomes one lot without number/expiry and one
-- opening_balance movement, so stock = sum of lots from day one. Recorded by the system
-- actor (same placeholder id as lib/audit.ts SYSTEM_ACTOR_ID).
INSERT INTO "tenant_template"."stock_lots" ("id", "tenant_id", "item_id", "lot_number", "expiry_date", "quantity")
SELECT gen_random_uuid(), i."tenant_id", i."id", 'STOCK-INITIAL', NULL, i."stock"
FROM "tenant_template"."medication_inventory" i
WHERE i."tenant_id" IS NOT NULL AND i."stock" > 0;

INSERT INTO "tenant_template"."stock_movements" ("id", "tenant_id", "item_id", "lot_id", "type", "quantity", "balance_after", "reason", "recorded_by_id")
SELECT gen_random_uuid(), l."tenant_id", l."item_id", l."id", 'opening_balance', l."quantity", l."quantity",
       'Reprise du stock existant à la mise en place des mouvements', '00000000-0000-0000-0000-000000000000'
FROM "tenant_template"."stock_lots" l
WHERE l."lot_number" = 'STOCK-INITIAL';
