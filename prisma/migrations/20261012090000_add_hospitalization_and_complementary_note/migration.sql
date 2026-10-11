-- AlterEnum
ALTER TYPE "tenant_template"."MedicalRecordType" ADD VALUE 'complementary_note' AFTER 'consultation';

-- AlterEnum
ALTER TYPE "tenant_template"."BillingSourceType" ADD VALUE 'hospitalization' AFTER 'consultation';

-- CreateEnum
CREATE TYPE "tenant_template"."HospitalizationStatus" AS ENUM ('awaiting_payment', 'admitted');

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "hospitalization_status" "tenant_template"."HospitalizationStatus",
ADD COLUMN     "hospitalization_act_code" VARCHAR(40),
ADD COLUMN     "hospitalization_department_id" UUID,
ADD COLUMN     "hospitalization_bed_id" UUID,
ADD COLUMN     "hospitalization_requested_at" TIMESTAMPTZ,
ADD COLUMN     "hospitalized_at" TIMESTAMPTZ;
