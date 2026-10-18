-- AlterEnum
ALTER TYPE "tenant_template"."ConsultationStatus" ADD VALUE 'awaiting_payment' BEFORE 'waiting';

-- AlterEnum
ALTER TYPE "tenant_template"."ExamRequestStatus" ADD VALUE 'awaiting_payment' BEFORE 'requested';

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "medical_act_code" VARCHAR(40);
