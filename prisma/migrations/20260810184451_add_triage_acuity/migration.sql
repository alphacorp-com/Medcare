-- CreateEnum
CREATE TYPE "tenant_template"."TriageAcuity" AS ENUM ('resuscitation', 'emergent', 'urgent', 'less_urgent', 'non_urgent');

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "triage_acuity" "tenant_template"."TriageAcuity";
