-- DropIndex
DROP INDEX "tenant_template"."departments_code_key";

-- DropIndex
DROP INDEX "tenant_template"."patients_ipp_idx";

-- DropIndex
DROP INDEX "tenant_template"."patients_ipp_key";

-- DropIndex
DROP INDEX "tenant_template"."stays_stay_number_key";

-- AlterTable
ALTER TABLE "tenant_template"."adverse_events" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."billing_stays" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."departments" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."drug_dispensings" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."exam_requests" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."exam_results" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."medical_records" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."medication_inventory" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."patients" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."prescriptions" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."schedules" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."surgical_procedures" ADD COLUMN     "tenant_id" UUID;

-- Backfill: assign all pre-existing rows (created before the second tenant existed) to the
-- first tenant, "Hôpital central de Foumbot".
UPDATE "tenant_template"."patients" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."stays" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."medical_records" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."prescriptions" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."exam_requests" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."exam_results" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."surgical_procedures" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."drug_dispensings" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."medication_inventory" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."departments" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."schedules" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."billing_stays" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "tenant_template"."adverse_events" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;

-- CreateIndex
CREATE INDEX "adverse_events_tenant_id_idx" ON "tenant_template"."adverse_events"("tenant_id");

-- CreateIndex
CREATE INDEX "billing_stays_tenant_id_idx" ON "tenant_template"."billing_stays"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "tenant_template"."departments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "tenant_template"."departments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "drug_dispensings_tenant_id_idx" ON "tenant_template"."drug_dispensings"("tenant_id");

-- CreateIndex
CREATE INDEX "exam_requests_tenant_id_idx" ON "tenant_template"."exam_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "exam_results_tenant_id_idx" ON "tenant_template"."exam_results"("tenant_id");

-- CreateIndex
CREATE INDEX "medical_records_tenant_id_idx" ON "tenant_template"."medical_records"("tenant_id");

-- CreateIndex
CREATE INDEX "medication_inventory_tenant_id_idx" ON "tenant_template"."medication_inventory"("tenant_id");

-- CreateIndex
CREATE INDEX "patients_tenant_id_idx" ON "tenant_template"."patients"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenant_id_ipp_key" ON "tenant_template"."patients"("tenant_id", "ipp");

-- CreateIndex
CREATE INDEX "prescriptions_tenant_id_idx" ON "tenant_template"."prescriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_idx" ON "tenant_template"."schedules"("tenant_id");

-- CreateIndex
CREATE INDEX "stays_tenant_id_idx" ON "tenant_template"."stays"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stays_tenant_id_stay_number_key" ON "tenant_template"."stays"("tenant_id", "stay_number");

-- CreateIndex
CREATE INDEX "surgical_procedures_tenant_id_idx" ON "tenant_template"."surgical_procedures"("tenant_id");
