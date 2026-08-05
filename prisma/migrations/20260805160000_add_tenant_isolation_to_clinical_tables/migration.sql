-- DropIndex
DROP INDEX "departments_code_key";

-- DropIndex
DROP INDEX "patients_ipp_idx";

-- DropIndex
DROP INDEX "patients_ipp_key";

-- DropIndex
DROP INDEX "stays_stay_number_key";

-- AlterTable
ALTER TABLE "adverse_events" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "billing_stays" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "drug_dispensings" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "exam_requests" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "medication_inventory" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "stays" ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "surgical_procedures" ADD COLUMN     "tenant_id" UUID;

-- Backfill: assign all pre-existing rows (created before the second tenant existed) to the
-- first tenant, "Hôpital central de Foumbot".
UPDATE "patients" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "stays" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "medical_records" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "prescriptions" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "exam_requests" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "exam_results" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "surgical_procedures" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "drug_dispensings" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "medication_inventory" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "departments" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "schedules" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "billing_stays" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;
UPDATE "adverse_events" SET "tenant_id" = '02872b2d-43d9-40c0-9fd7-49adae783312' WHERE "tenant_id" IS NULL;

-- CreateIndex
CREATE INDEX "adverse_events_tenant_id_idx" ON "adverse_events"("tenant_id");

-- CreateIndex
CREATE INDEX "billing_stays_tenant_id_idx" ON "billing_stays"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "drug_dispensings_tenant_id_idx" ON "drug_dispensings"("tenant_id");

-- CreateIndex
CREATE INDEX "exam_requests_tenant_id_idx" ON "exam_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "exam_results_tenant_id_idx" ON "exam_results"("tenant_id");

-- CreateIndex
CREATE INDEX "medical_records_tenant_id_idx" ON "medical_records"("tenant_id");

-- CreateIndex
CREATE INDEX "medication_inventory_tenant_id_idx" ON "medication_inventory"("tenant_id");

-- CreateIndex
CREATE INDEX "patients_tenant_id_idx" ON "patients"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenant_id_ipp_key" ON "patients"("tenant_id", "ipp");

-- CreateIndex
CREATE INDEX "prescriptions_tenant_id_idx" ON "prescriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_idx" ON "schedules"("tenant_id");

-- CreateIndex
CREATE INDEX "stays_tenant_id_idx" ON "stays"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stays_tenant_id_stay_number_key" ON "stays"("tenant_id", "stay_number");

-- CreateIndex
CREATE INDEX "surgical_procedures_tenant_id_idx" ON "surgical_procedures"("tenant_id");
