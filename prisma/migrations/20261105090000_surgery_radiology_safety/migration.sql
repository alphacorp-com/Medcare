-- Surgery and radiology safety and traceability (docs/modules/chirurgie, docs/modules/radiologie).
-- Additive only: new nullable / defaulted columns and new tables; no existing data is changed.

-- ── Surgery ─────────────────────────────────────────────────────────────────
CREATE TYPE "tenant_template"."SurgicalSupplyKind" AS ENUM ('consumable', 'implant');

ALTER TABLE "tenant_template"."surgical_procedures"
  ADD COLUMN "expected_duration_minutes" SMALLINT,
  ADD COLUMN "is_emergency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consent_obtained_at" TIMESTAMPTZ,
  ADD COLUMN "consent_obtained_by_id" UUID,
  ADD COLUMN "consent_notes" TEXT,
  ADD COLUMN "pre_anesthesia_at" TIMESTAMPTZ,
  ADD COLUMN "pre_anesthesia_by_id" UUID,
  ADD COLUMN "pre_anesthesia_notes" TEXT,
  ADD COLUMN "team" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "anesthesia_start_at" TIMESTAMPTZ,
  ADD COLUMN "incision_at" TIMESTAMPTZ,
  ADD COLUMN "closure_at" TIMESTAMPTZ,
  ADD COLUMN "anesthesia_end_at" TIMESTAMPTZ,
  ADD COLUMN "status_reason" TEXT;

ALTER TABLE "tenant_template"."surgical_procedures"
  ADD CONSTRAINT "surgical_procedures_duration_check" CHECK ("expected_duration_minutes" IS NULL OR "expected_duration_minutes" BETWEEN 5 AND 1440);

CREATE TABLE "tenant_template"."surgical_supply_uses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "surgery_id" UUID NOT NULL,
    "kind" "tenant_template"."SurgicalSupplyKind" NOT NULL,
    "item_id" UUID,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot_number" VARCHAR(60),
    "serial_number" VARCHAR(120),
    "manufacturer" VARCHAR(255),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surgical_supply_uses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "surgical_supply_uses_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "surgical_supply_uses_tenant_id_idx" ON "tenant_template"."surgical_supply_uses"("tenant_id");
CREATE INDEX "surgical_supply_uses_surgery_id_idx" ON "tenant_template"."surgical_supply_uses"("surgery_id");
ALTER TABLE "tenant_template"."surgical_supply_uses" ADD CONSTRAINT "surgical_supply_uses_surgery_id_fkey" FOREIGN KEY ("surgery_id") REFERENCES "tenant_template"."surgical_procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Radiology ───────────────────────────────────────────────────────────────
ALTER TABLE "tenant_template"."exam_requests"
  ADD COLUMN "device_id" UUID,
  ADD COLUMN "expected_duration_minutes" SMALLINT,
  ADD COLUMN "accession_number" VARCHAR(32),
  ADD COLUMN "safety_check" JSONB;

ALTER TABLE "tenant_template"."exam_requests"
  ADD CONSTRAINT "exam_requests_duration_check" CHECK ("expected_duration_minutes" IS NULL OR "expected_duration_minutes" BETWEEN 5 AND 480);

CREATE UNIQUE INDEX "exam_requests_tenant_id_accession_number_key" ON "tenant_template"."exam_requests"("tenant_id", "accession_number");
CREATE INDEX "exam_requests_device_id_scheduled_at_idx" ON "tenant_template"."exam_requests"("device_id", "scheduled_at");

CREATE TABLE "tenant_template"."exam_result_addenda" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "result_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_result_addenda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_result_addenda_tenant_id_idx" ON "tenant_template"."exam_result_addenda"("tenant_id");
CREATE INDEX "exam_result_addenda_result_id_idx" ON "tenant_template"."exam_result_addenda"("result_id");
ALTER TABLE "tenant_template"."exam_result_addenda" ADD CONSTRAINT "exam_result_addenda_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "tenant_template"."exam_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tenant_template"."imaging_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "modality_item_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imaging_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "imaging_devices_tenant_id_code_key" ON "tenant_template"."imaging_devices"("tenant_id", "code");
CREATE INDEX "imaging_devices_tenant_id_idx" ON "tenant_template"."imaging_devices"("tenant_id");
