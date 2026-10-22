-- ARV emergency supplies without enrolment, viral loads fed by validated lab results.
-- Additive only.

-- AlterTable
ALTER TABLE "tenant_template"."exam_catalog_entries" ADD COLUMN     "viral_load_program" "tenant_template"."ViralLoadProgram";

-- AlterTable
ALTER TABLE "tenant_template"."viral_load_results" ADD COLUMN     "exam_result_id" UUID;

-- CreateTable
CREATE TABLE "tenant_template"."art_emergency_supplies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "supply_date" DATE NOT NULL,
    "regimen_code" VARCHAR(40) NOT NULL,
    "regimen_line" INTEGER NOT NULL,
    "days_dispensed" INTEGER NOT NULL,
    "origin_site" VARCHAR(150) NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_emergency_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "art_emergency_supplies_tenant_id_supply_date_idx" ON "tenant_template"."art_emergency_supplies"("tenant_id", "supply_date");

-- CreateIndex
CREATE UNIQUE INDEX "viral_load_results_exam_result_id_key" ON "tenant_template"."viral_load_results"("exam_result_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."art_emergency_supplies" ADD CONSTRAINT "art_emergency_supplies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity
ALTER TABLE "tenant_template"."art_emergency_supplies" ADD CONSTRAINT "art_emergency_supplies_values_valid" CHECK ("regimen_line" BETWEEN 1 AND 3 AND "days_dispensed" BETWEEN 1 AND 366);
