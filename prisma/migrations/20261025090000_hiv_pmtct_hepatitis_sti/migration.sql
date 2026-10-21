-- HIV / PMTCT, hepatitis and STI programs: screening register (manual or from validated
-- lab results), ART follow-up, viral loads, HIV-exposed infants, hepatitis cases, PMTCT
-- status of the pregnancy (own table: HIV-sensitive). Additive only.

-- CreateEnum
CREATE TYPE "tenant_template"."ScreeningTestType" AS ENUM ('hiv', 'hiv_pcr', 'syphilis', 'hbsag', 'hcv', 'hdv', 'chlamydia', 'mycoplasma', 'gonorrhea', 'other_sti');

-- CreateEnum
CREATE TYPE "tenant_template"."ScreeningResult" AS ENUM ('positive', 'negative', 'indeterminate', 'invalid');

-- CreateEnum
CREATE TYPE "tenant_template"."ScreeningEntryPoint" AS ENUM ('index_case', 'emergency', 'antenatal', 'maternity', 'postnatal', 'pediatric', 'inpatient', 'outpatient', 'vct', 'tb', 'sti', 'family_planning', 'community', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."ReferralSource" AS ENUM ('none', 'asc', 'obc');

-- CreateEnum
CREATE TYPE "tenant_template"."HivCareStatus" AS ENUM ('active', 'transferred_out', 'dead', 'stopped');

-- CreateEnum
CREATE TYPE "tenant_template"."TransferScope" AS ENUM ('in_country', 'abroad');

-- CreateEnum
CREATE TYPE "tenant_template"."ViralLoadProgram" AS ENUM ('hiv', 'hbv', 'hcv');

-- CreateEnum
CREATE TYPE "tenant_template"."HepatitisType" AS ENUM ('hbv', 'hcv');

-- AlterTable
ALTER TABLE "tenant_template"."pregnancies" ADD COLUMN     "referral_source" "tenant_template"."ReferralSource" NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "tenant_template"."exam_catalog_entries" ADD COLUMN     "screening_test_type" "tenant_template"."ScreeningTestType";

-- CreateTable
CREATE TABLE "tenant_template"."screening_tests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "test_type" "tenant_template"."ScreeningTestType" NOT NULL,
    "tested_at" TIMESTAMPTZ NOT NULL,
    "result" "tenant_template"."ScreeningResult" NOT NULL,
    "entry_point" "tenant_template"."ScreeningEntryPoint" NOT NULL,
    "is_retest" BOOLEAN NOT NULL DEFAULT false,
    "result_collected_at" TIMESTAMPTZ,
    "pregnancy_id" UUID,
    "partner_of_pregnancy_id" UUID,
    "referral_source" "tenant_template"."ReferralSource" NOT NULL DEFAULT 'none',
    "treated_at" TIMESTAMPTZ,
    "exam_result_id" UUID,
    "notes" VARCHAR(500),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."pmtct_pregnancy_status" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pregnancy_id" UUID NOT NULL,
    "hiv_known_positive_at_entry" BOOLEAN NOT NULL DEFAULT false,
    "on_art_at_entry" BOOLEAN NOT NULL DEFAULT false,
    "hbv_known_positive_at_entry" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pmtct_pregnancy_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."hiv_care_enrolments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "hiv_diagnosis_date" DATE,
    "art_start_date" DATE NOT NULL,
    "enrolled_at" DATE NOT NULL,
    "entry_point" "tenant_template"."ScreeningEntryPoint" NOT NULL,
    "transfer_in" "tenant_template"."TransferScope",
    "pregnancy_id" UUID,
    "status" "tenant_template"."HivCareStatus" NOT NULL DEFAULT 'active',
    "status_changed_at" DATE,
    "transfer_out" "tenant_template"."TransferScope",
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hiv_care_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."art_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enrolment_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "regimen_code" VARCHAR(40) NOT NULL,
    "regimen_line" INTEGER NOT NULL,
    "days_dispensed" INTEGER NOT NULL,
    "next_appointment_date" DATE NOT NULL,
    "is_emergency_supply" BOOLEAN NOT NULL DEFAULT false,
    "tb_screened" BOOLEAN NOT NULL DEFAULT false,
    "tb_symptoms_positive" BOOLEAN NOT NULL DEFAULT false,
    "tb_tested" BOOLEAN NOT NULL DEFAULT false,
    "tb_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "tb_treatment_started" BOOLEAN NOT NULL DEFAULT false,
    "ipt_started" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."viral_load_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "program" "tenant_template"."ViralLoadProgram" NOT NULL,
    "sampled_at" DATE NOT NULL,
    "value" INTEGER,
    "below_detection" BOOLEAN NOT NULL DEFAULT false,
    "pregnancy_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viral_load_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."hiv_exposed_infants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "mother_patient_id" UUID,
    "born_in_facility" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" DATE NOT NULL,
    "nevirapine_started_at" DATE,
    "cotrimoxazole_started_at" DATE,
    "visit_6_8_weeks_at" DATE,
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hiv_exposed_infants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."hepatitis_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "tenant_template"."HepatitisType" NOT NULL,
    "diagnosed_at" DATE NOT NULL,
    "delta_positive" BOOLEAN,
    "eligible_at" DATE,
    "treatment_started_at" DATE,
    "treatment_stopped_at" DATE,
    "cured_at" DATE,
    "cirrhosis_at" DATE,
    "liver_cancer_at" DATE,
    "died_at" DATE,
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hepatitis_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screening_tests_exam_result_id_key" ON "tenant_template"."screening_tests"("exam_result_id");

-- CreateIndex
CREATE INDEX "screening_tests_tenant_id_tested_at_idx" ON "tenant_template"."screening_tests"("tenant_id", "tested_at");

-- CreateIndex
CREATE INDEX "screening_tests_patient_id_test_type_idx" ON "tenant_template"."screening_tests"("patient_id", "test_type");

-- CreateIndex
CREATE INDEX "screening_tests_pregnancy_id_idx" ON "tenant_template"."screening_tests"("pregnancy_id");

-- CreateIndex
CREATE UNIQUE INDEX "pmtct_pregnancy_status_pregnancy_id_key" ON "tenant_template"."pmtct_pregnancy_status"("pregnancy_id");

-- CreateIndex
CREATE INDEX "pmtct_pregnancy_status_tenant_id_idx" ON "tenant_template"."pmtct_pregnancy_status"("tenant_id");

-- CreateIndex
CREATE INDEX "hiv_care_enrolments_tenant_id_status_idx" ON "tenant_template"."hiv_care_enrolments"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hiv_care_enrolments_tenant_id_patient_id_key" ON "tenant_template"."hiv_care_enrolments"("tenant_id", "patient_id");

-- CreateIndex
CREATE INDEX "art_visits_enrolment_id_visit_date_idx" ON "tenant_template"."art_visits"("enrolment_id", "visit_date");

-- CreateIndex
CREATE INDEX "art_visits_tenant_id_visit_date_idx" ON "tenant_template"."art_visits"("tenant_id", "visit_date");

-- CreateIndex
CREATE INDEX "viral_load_results_tenant_id_sampled_at_idx" ON "tenant_template"."viral_load_results"("tenant_id", "sampled_at");

-- CreateIndex
CREATE INDEX "viral_load_results_patient_id_program_idx" ON "tenant_template"."viral_load_results"("patient_id", "program");

-- CreateIndex
CREATE UNIQUE INDEX "hiv_exposed_infants_patient_id_key" ON "tenant_template"."hiv_exposed_infants"("patient_id");

-- CreateIndex
CREATE INDEX "hiv_exposed_infants_tenant_id_first_seen_at_idx" ON "tenant_template"."hiv_exposed_infants"("tenant_id", "first_seen_at");

-- CreateIndex
CREATE INDEX "hepatitis_cases_tenant_id_diagnosed_at_idx" ON "tenant_template"."hepatitis_cases"("tenant_id", "diagnosed_at");

-- CreateIndex
CREATE UNIQUE INDEX "hepatitis_cases_tenant_id_patient_id_type_key" ON "tenant_template"."hepatitis_cases"("tenant_id", "patient_id", "type");

-- AddForeignKey
ALTER TABLE "tenant_template"."screening_tests" ADD CONSTRAINT "screening_tests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."pmtct_pregnancy_status" ADD CONSTRAINT "pmtct_pregnancy_status_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "tenant_template"."pregnancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."hiv_care_enrolments" ADD CONSTRAINT "hiv_care_enrolments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."art_visits" ADD CONSTRAINT "art_visits_enrolment_id_fkey" FOREIGN KEY ("enrolment_id") REFERENCES "tenant_template"."hiv_care_enrolments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."viral_load_results" ADD CONSTRAINT "viral_load_results_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."hiv_exposed_infants" ADD CONSTRAINT "hiv_exposed_infants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."hepatitis_cases" ADD CONSTRAINT "hepatitis_cases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity
ALTER TABLE "tenant_template"."art_visits" ADD CONSTRAINT "art_visits_values_valid" CHECK ("regimen_line" BETWEEN 1 AND 3 AND "days_dispensed" BETWEEN 1 AND 366 AND "next_appointment_date" >= "visit_date");
ALTER TABLE "tenant_template"."viral_load_results" ADD CONSTRAINT "viral_load_results_value_valid" CHECK ("value" IS NULL OR "value" >= 0);
