-- CreateEnum
CREATE TYPE "tenant_template"."ConsultationStatus" AS ENUM ('waiting', 'claimed', 'completed');

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "triaged_at" TIMESTAMPTZ,
ADD COLUMN     "consultation_status" "tenant_template"."ConsultationStatus" NOT NULL DEFAULT 'waiting';

-- CreateIndex
CREATE INDEX "stays_consultation_status_idx" ON "tenant_template"."stays"("consultation_status");
