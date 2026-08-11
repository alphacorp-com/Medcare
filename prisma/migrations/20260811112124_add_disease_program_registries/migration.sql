-- CreateEnum
CREATE TYPE "MalariaTestType" AS ENUM ('rdt', 'microscopy', 'clinical_only');

-- CreateEnum
CREATE TYPE "MalariaResult" AS ENUM ('pending', 'positive', 'negative');

-- CreateEnum
CREATE TYPE "MalariaSeverity" AS ENUM ('simple', 'severe');

-- CreateEnum
CREATE TYPE "TbCaseType" AS ENUM ('new_case', 'relapse', 'treatment_after_failure', 'treatment_after_loss_to_follow_up', 'transfer_in', 'other');

-- CreateEnum
CREATE TYPE "TbClassification" AS ENUM ('pulmonary_bacteriologically_confirmed', 'pulmonary_clinically_diagnosed', 'extrapulmonary');

-- CreateEnum
CREATE TYPE "TbHivStatus" AS ENUM ('positive', 'negative', 'unknown');

-- CreateEnum
CREATE TYPE "TbTreatmentOutcome" AS ENUM ('on_treatment', 'cured', 'treatment_completed', 'treatment_failed', 'died', 'lost_to_follow_up', 'not_evaluated', 'transferred_out');

-- CreateEnum
CREATE TYPE "TbSputumResult" AS ENUM ('not_done', 'negative', 'positive');

-- CreateEnum
CREATE TYPE "TbControlPoint" AS ENUM ('m2', 'm3', 'm5', 'm6', 'other');

-- AlterEnum
ALTER TYPE "ReferenceCatalogType" ADD VALUE 'vaccine_antigen';

-- CreateTable
CREATE TABLE "immunizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "antigen_code" VARCHAR(40) NOT NULL,
    "antigen_name" VARCHAR(150) NOT NULL,
    "dose_number" INTEGER NOT NULL DEFAULT 1,
    "administered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administered_by_id" UUID NOT NULL,
    "age_in_days_at_administration" INTEGER NOT NULL,
    "lot_number" VARCHAR(60),
    "expiry_date" DATE,
    "is_out_of_schedule" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malaria_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "exam_result_id" UUID,
    "test_type" "MalariaTestType" NOT NULL,
    "result" "MalariaResult" NOT NULL DEFAULT 'pending',
    "severity" "MalariaSeverity",
    "is_pregnant_at_diagnosis" BOOLEAN NOT NULL DEFAULT false,
    "age_in_days_at_diagnosis" INTEGER NOT NULL,
    "diagnosed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosed_by_id" UUID NOT NULL,
    "treated_with_act" BOOLEAN NOT NULL DEFAULT false,
    "treatment_drug_name" VARCHAR(150),
    "treated_at" TIMESTAMPTZ,
    "notes" TEXT,

    CONSTRAINT "malaria_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "notification_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "case_type" "TbCaseType" NOT NULL,
    "classification" "TbClassification" NOT NULL,
    "hiv_status" "TbHivStatus" NOT NULL DEFAULT 'unknown',
    "weight_kg_at_diagnosis" DECIMAL(5,2),
    "confirming_exam_result_id" UUID,
    "treatment_regimen" VARCHAR(100),
    "treatment_start_date" TIMESTAMPTZ,
    "outcome" "TbTreatmentOutcome" NOT NULL DEFAULT 'on_treatment',
    "outcome_date" TIMESTAMPTZ,
    "registered_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tb_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_follow_ups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "tb_case_id" UUID NOT NULL,
    "follow_up_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "control_point" "TbControlPoint" NOT NULL,
    "sputum_result" "TbSputumResult" NOT NULL DEFAULT 'not_done',
    "weight_kg" DECIMAL(5,2),
    "outcome_recorded" "TbTreatmentOutcome",
    "recorded_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "immunizations_tenant_id_idx" ON "immunizations"("tenant_id");

-- CreateIndex
CREATE INDEX "immunizations_patient_id_administered_at_idx" ON "immunizations"("patient_id", "administered_at" DESC);

-- CreateIndex
CREATE INDEX "immunizations_antigen_code_idx" ON "immunizations"("antigen_code");

-- CreateIndex
CREATE INDEX "malaria_cases_tenant_id_idx" ON "malaria_cases"("tenant_id");

-- CreateIndex
CREATE INDEX "malaria_cases_patient_id_diagnosed_at_idx" ON "malaria_cases"("patient_id", "diagnosed_at" DESC);

-- CreateIndex
CREATE INDEX "tb_cases_tenant_id_idx" ON "tb_cases"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_cases_patient_id_notification_date_idx" ON "tb_cases"("patient_id", "notification_date" DESC);

-- CreateIndex
CREATE INDEX "tb_follow_ups_tenant_id_idx" ON "tb_follow_ups"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_follow_ups_tb_case_id_follow_up_date_idx" ON "tb_follow_ups"("tb_case_id", "follow_up_date");

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malaria_cases" ADD CONSTRAINT "malaria_cases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malaria_cases" ADD CONSTRAINT "malaria_cases_exam_result_id_fkey" FOREIGN KEY ("exam_result_id") REFERENCES "exam_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_cases" ADD CONSTRAINT "tb_cases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_cases" ADD CONSTRAINT "tb_cases_confirming_exam_result_id_fkey" FOREIGN KEY ("confirming_exam_result_id") REFERENCES "exam_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_follow_ups" ADD CONSTRAINT "tb_follow_ups_tb_case_id_fkey" FOREIGN KEY ("tb_case_id") REFERENCES "tb_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
