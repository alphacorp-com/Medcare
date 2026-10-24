-- New RMA3 modules: malaria complements (species, antimalarial, hospitalisation, free
-- treatment, ITN at antenatal visits), biomedical equipment and hypoxaemia episodes (V.9),
-- acute malnutrition cases and growth monitoring (IV.6, III.9), blood bank (V.6), staff
-- register (VI.5). Additive only.
-- CreateEnum
CREATE TYPE "tenant_template"."MalariaSpecies" AS ENUM ('falciparum', 'mixed', 'vivax', 'malariae', 'ovale', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."MalariaTreatment" AS ENUM ('asaq', 'al', 'dhap', 'other_act', 'quinine_oral', 'artesunate_inj', 'artemether_inj', 'quinine_inj');

-- CreateEnum
CREATE TYPE "tenant_template"."BiomedicalEquipmentType" AS ENUM ('pulse_oximeter', 'oxygen_concentrator', 'ventilator', 'oxygen_cylinder_7500', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."BiomedicalEquipmentStatus" AS ENUM ('functional', 'broken', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "tenant_template"."HypoxemiaOutcome" AS ENUM ('cured', 'referred', 'left_against_advice', 'died');

-- CreateEnum
CREATE TYPE "tenant_template"."NutritionProgram" AS ENUM ('cna', 'cnti');

-- CreateEnum
CREATE TYPE "tenant_template"."NutritionAdmissionType" AS ENUM ('new_case', 'relapse', 'readmission_after_default', 'transfer_in');

-- CreateEnum
CREATE TYPE "tenant_template"."NutritionCriterion" AS ENUM ('whz', 'muac', 'oedema');

-- CreateEnum
CREATE TYPE "tenant_template"."NutritionResidency" AS ENUM ('resident', 'displaced', 'refugee');

-- CreateEnum
CREATE TYPE "tenant_template"."NutritionExitReason" AS ENUM ('cured', 'defaulted', 'died', 'non_responder', 'transfer_out');

-- CreateEnum
CREATE TYPE "tenant_template"."BloodDonorType" AS ENUM ('voluntary', 'family');

-- CreateEnum
CREATE TYPE "tenant_template"."BloodTestResult" AS ENUM ('not_done', 'negative', 'positive', 'indeterminate');

-- CreateEnum
CREATE TYPE "tenant_template"."BloodBagStatus" AS ENUM ('quarantine', 'available', 'served', 'transfused', 'destroyed');

-- CreateEnum
CREATE TYPE "tenant_template"."StaffPayer" AS ENUM ('state', 'local');

-- AlterTable
ALTER TABLE "tenant_template"."antenatal_visits" ADD COLUMN     "itn_given" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenant_template"."malaria_cases" ADD COLUMN     "free_of_charge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hospitalized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "species" "tenant_template"."MalariaSpecies",
ADD COLUMN     "treatment" "tenant_template"."MalariaTreatment";

-- CreateTable
CREATE TABLE "tenant_template"."biomedical_equipment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "tenant_template"."BiomedicalEquipmentType" NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "serial_number" VARCHAR(80),
    "location" VARCHAR(150),
    "status" "tenant_template"."BiomedicalEquipmentStatus" NOT NULL DEFAULT 'functional',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "biomedical_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."hypoxemia_episodes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "detected_at" TIMESTAMPTZ NOT NULL,
    "spo2" INTEGER,
    "respiratory_distress" BOOLEAN NOT NULL DEFAULT false,
    "delivery_room" BOOLEAN NOT NULL DEFAULT false,
    "oxygen_given" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "tenant_template"."HypoxemiaOutcome",
    "outcome_at" TIMESTAMPTZ,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hypoxemia_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."nutrition_cases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "program" "tenant_template"."NutritionProgram" NOT NULL,
    "admitted_at" TIMESTAMPTZ NOT NULL,
    "admission_type" "tenant_template"."NutritionAdmissionType" NOT NULL,
    "criterion" "tenant_template"."NutritionCriterion",
    "muac_mm" INTEGER,
    "whz" DECIMAL(4,1),
    "residency" "tenant_template"."NutritionResidency" NOT NULL DEFAULT 'resident',
    "hiv_tested" BOOLEAN NOT NULL DEFAULT false,
    "anje_counseling" BOOLEAN NOT NULL DEFAULT false,
    "exited_at" TIMESTAMPTZ,
    "exit_reason" "tenant_template"."NutritionExitReason",
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nutrition_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."growth_monitoring_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,1),
    "muac_mm" INTEGER,
    "counseling" BOOLEAN NOT NULL DEFAULT false,
    "exclusive_breastfeeding" BOOLEAN,
    "receives_water" BOOLEAN,
    "complementary_food" BOOLEAN,
    "still_breastfed" BOOLEAN,
    "multivitamin_given" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_monitoring_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."blood_donors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "sex" "tenant_template"."Gender" NOT NULL,
    "birth_date" DATE,
    "phone" VARCHAR(30),
    "blood_group" VARCHAR(5),
    "donor_type" "tenant_template"."BloodDonorType" NOT NULL,
    "patient_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blood_donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."blood_collection_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "held_at" TIMESTAMPTZ NOT NULL,
    "location" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_collection_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."blood_donations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "session_id" UUID,
    "bag_number" VARCHAR(40) NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL,
    "hiv_result" "tenant_template"."BloodTestResult" NOT NULL DEFAULT 'not_done',
    "hbv_result" "tenant_template"."BloodTestResult" NOT NULL DEFAULT 'not_done',
    "hcv_result" "tenant_template"."BloodTestResult" NOT NULL DEFAULT 'not_done',
    "syphilis_result" "tenant_template"."BloodTestResult" NOT NULL DEFAULT 'not_done',
    "status" "tenant_template"."BloodBagStatus" NOT NULL DEFAULT 'quarantine',
    "served_at" TIMESTAMPTZ,
    "transfused_at" TIMESTAMPTZ,
    "recipient_patient_id" UUID,
    "destroyed_at" TIMESTAMPTZ,
    "destruction_reason" VARCHAR(200),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blood_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."staff_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "sex" "tenant_template"."Gender" NOT NULL,
    "cadre" VARCHAR(40) NOT NULL,
    "payer" "tenant_template"."StaffPayer" NOT NULL,
    "in_post" BOOLEAN NOT NULL DEFAULT true,
    "birth_date" DATE,
    "hired_at" DATE,
    "retirement_date" DATE,
    "left_at" DATE,
    "tenant_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "biomedical_equipment_tenant_id_idx" ON "tenant_template"."biomedical_equipment"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "biomedical_equipment_tenant_id_code_key" ON "tenant_template"."biomedical_equipment"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hypoxemia_episodes_tenant_id_detected_at_idx" ON "tenant_template"."hypoxemia_episodes"("tenant_id", "detected_at");

-- CreateIndex
CREATE INDEX "nutrition_cases_tenant_id_admitted_at_idx" ON "tenant_template"."nutrition_cases"("tenant_id", "admitted_at");

-- CreateIndex
CREATE INDEX "nutrition_cases_patient_id_idx" ON "tenant_template"."nutrition_cases"("patient_id");

-- CreateIndex
CREATE INDEX "growth_monitoring_visits_tenant_id_visit_date_idx" ON "tenant_template"."growth_monitoring_visits"("tenant_id", "visit_date");

-- CreateIndex
CREATE INDEX "growth_monitoring_visits_patient_id_idx" ON "tenant_template"."growth_monitoring_visits"("patient_id");

-- CreateIndex
CREATE INDEX "blood_donors_tenant_id_idx" ON "tenant_template"."blood_donors"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donors_tenant_id_code_key" ON "tenant_template"."blood_donors"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "blood_collection_sessions_tenant_id_held_at_idx" ON "tenant_template"."blood_collection_sessions"("tenant_id", "held_at");

-- CreateIndex
CREATE INDEX "blood_donations_tenant_id_collected_at_idx" ON "tenant_template"."blood_donations"("tenant_id", "collected_at");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donations_tenant_id_bag_number_key" ON "tenant_template"."blood_donations"("tenant_id", "bag_number");

-- CreateIndex
CREATE INDEX "staff_members_tenant_id_idx" ON "tenant_template"."staff_members"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."hypoxemia_episodes" ADD CONSTRAINT "hypoxemia_episodes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."nutrition_cases" ADD CONSTRAINT "nutrition_cases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."growth_monitoring_visits" ADD CONSTRAINT "growth_monitoring_visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."blood_donations" ADD CONSTRAINT "blood_donations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "tenant_template"."blood_donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."blood_donations" ADD CONSTRAINT "blood_donations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant_template"."blood_collection_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Defence in depth (the API validates first).
ALTER TABLE "tenant_template"."hypoxemia_episodes" ADD CONSTRAINT "hypoxemia_episodes_spo2_check" CHECK ("spo2" IS NULL OR "spo2" BETWEEN 30 AND 100);
ALTER TABLE "tenant_template"."nutrition_cases" ADD CONSTRAINT "nutrition_cases_exit_check" CHECK (("exited_at" IS NULL) = ("exit_reason" IS NULL));
ALTER TABLE "tenant_template"."nutrition_cases" ADD CONSTRAINT "nutrition_cases_muac_check" CHECK ("muac_mm" IS NULL OR "muac_mm" BETWEEN 50 AND 400);
