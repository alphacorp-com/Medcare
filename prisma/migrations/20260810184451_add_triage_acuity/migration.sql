-- CreateEnum
CREATE TYPE "TriageAcuity" AS ENUM ('resuscitation', 'emergent', 'urgent', 'less_urgent', 'non_urgent');

-- AlterTable
ALTER TABLE "stays" ADD COLUMN     "triage_acuity" "TriageAcuity";
