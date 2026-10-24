-- Last RMA3 complements: TB screening register, TB case complements (TB-RR, 2nd line,
-- cotrimoxazole, health worker), chronic care register, civil registration declarations,
-- pharmacovigilance, national-protocol flag on consultations, RMA3 income rubric of the act
-- categories, iron / folic acid treatment tag, EPI interventions (TPIn, LLIN, deworming).
-- Additive only (one CHECK constraint is widened).
-- CreateEnum
CREATE TYPE "tenant_template"."ChronicCondition" AS ENUM ('diabetes', 'hypertension');

-- CreateEnum
CREATE TYPE "tenant_template"."ChronicExitReason" AS ENUM ('lost_to_follow_up', 'transferred', 'died', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."CivilEventType" AS ENUM ('birth', 'death');

-- AlterTable
ALTER TABLE "tenant_template"."stays" ADD COLUMN     "followed_national_protocol" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenant_template"."medical_act_categories" ADD COLUMN     "rma3_income_rubric" VARCHAR(20);

-- AlterTable
ALTER TABLE "tenant_template"."tb_cases" ADD COLUMN     "cotrimoxazole" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_health_worker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rifampicin_resistant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "second_line_started_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "tenant_template"."tb_screenings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "screened_at" TIMESTAMPTZ NOT NULL,
    "presumptive" BOOLEAN NOT NULL DEFAULT false,
    "sent_to_lab_at" TIMESTAMPTZ,
    "tested_at" TIMESTAMPTZ,
    "test_positive" BOOLEAN,
    "tpt_started_at" TIMESTAMPTZ,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."chronic_care_enrolments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "condition" "tenant_template"."ChronicCondition" NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL,
    "exited_at" TIMESTAMPTZ,
    "exit_reason" "tenant_template"."ChronicExitReason",
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chronic_care_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."chronic_care_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enrolment_id" UUID NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL,
    "on_treatment" BOOLEAN NOT NULL DEFAULT false,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "hba1c" DECIMAL(4,1),
    "education_individual" BOOLEAN NOT NULL DEFAULT false,
    "education_group" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chronic_care_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."civil_registration_declarations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "tenant_template"."CivilEventType" NOT NULL,
    "patient_id" UUID,
    "person_name" VARCHAR(150) NOT NULL,
    "event_date" DATE NOT NULL,
    "transmitted_at" DATE NOT NULL,
    "reference" VARCHAR(80),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "civil_registration_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."drug_adverse_reactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "inventory_id" UUID,
    "drug_name" VARCHAR(255) NOT NULL,
    "lot_number" VARCHAR(60),
    "expiry_date" DATE,
    "reaction_at" TIMESTAMPTZ NOT NULL,
    "description" TEXT NOT NULL,
    "serious" BOOLEAN NOT NULL DEFAULT false,
    "investigated_at" TIMESTAMPTZ,
    "outcome" VARCHAR(200),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drug_adverse_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_screenings_tenant_id_screened_at_idx" ON "tenant_template"."tb_screenings"("tenant_id", "screened_at");

-- CreateIndex
CREATE INDEX "chronic_care_enrolments_tenant_id_condition_idx" ON "tenant_template"."chronic_care_enrolments"("tenant_id", "condition");

-- CreateIndex
CREATE INDEX "chronic_care_visits_tenant_id_visit_date_idx" ON "tenant_template"."chronic_care_visits"("tenant_id", "visit_date");

-- CreateIndex
CREATE INDEX "civil_registration_declarations_tenant_id_transmitted_at_idx" ON "tenant_template"."civil_registration_declarations"("tenant_id", "transmitted_at");

-- CreateIndex
CREATE INDEX "drug_adverse_reactions_tenant_id_created_at_idx" ON "tenant_template"."drug_adverse_reactions"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_template"."tb_screenings" ADD CONSTRAINT "tb_screenings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."chronic_care_enrolments" ADD CONSTRAINT "chronic_care_enrolments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."chronic_care_visits" ADD CONSTRAINT "chronic_care_visits_enrolment_id_fkey" FOREIGN KEY ("enrolment_id") REFERENCES "tenant_template"."chronic_care_enrolments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."drug_adverse_reactions" ADD CONSTRAINT "drug_adverse_reactions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RMA3 treatment tag: iron / folic acid added (lib/stock/input RMA3_TREATMENTS).
ALTER TABLE "tenant_template"."medication_inventory" DROP CONSTRAINT IF EXISTS "medication_inventory_rma3_treatment_check";
ALTER TABLE "tenant_template"."medication_inventory" ADD CONSTRAINT "medication_inventory_rma3_treatment_check" CHECK ("rma3_treatment" IS NULL OR "rma3_treatment" IN ('ors', 'zinc', 'antibiotic', 'iron_folate'));

-- EPI interventions recorded like doses (RMA3 III.2-026 to 037), for every facility that has a
-- vaccine catalog. Existing items are left untouched.
INSERT INTO "tenant_template"."reference_catalog_items" ("id", "tenant_id", "catalog_type", "code", "name_fr", "group", "order", "is_active", "metadata", "created_at", "updated_at")
SELECT gen_random_uuid(), t."tenant_id", 'vaccine_antigen'::"tenant_template"."ReferenceCatalogType", v."code", v."name_fr", v."group", v."order", true, '{}'::jsonb, now(), now()
FROM (SELECT DISTINCT "tenant_id" FROM "tenant_template"."reference_catalog_items" WHERE "catalog_type" = 'vaccine_antigen' AND "tenant_id" IS NOT NULL) t
CROSS JOIN (VALUES
  ('TPIN1', 'TPIn 1', 'TPIN', 31),
  ('TPIN2', 'TPIn 2', 'TPIN', 32),
  ('TPIN3', 'TPIn 3', 'TPIN', 33),
  ('TPIN4', 'TPIn 4', 'TPIN', 34),
  ('TPIN5', 'TPIn 5', 'TPIN', 35),
  ('TPIN6', 'TPIn 6', 'TPIN', 36),
  ('TPIN7', 'TPIn 7', 'TPIN', 37),
  ('TPIN8', 'TPIn 8', 'TPIN', 38),
  ('MILDA', 'MILDA (remise lors de la vaccination)', 'MILDA', 39),
  ('DEWORM', 'Mébendazole / Albendazole (déparasitage)', 'DEWORM', 40)
) AS v("code", "name_fr", "group", "order")
ON CONFLICT ("tenant_id", "catalog_type", "code") DO NOTHING;

-- Defence in depth (the API validates first).
ALTER TABLE "tenant_template"."chronic_care_visits" ADD CONSTRAINT "chronic_care_visits_bp_check" CHECK (("systolic" IS NULL OR "systolic" BETWEEN 50 AND 300) AND ("diastolic" IS NULL OR "diastolic" BETWEEN 20 AND 200));
ALTER TABLE "tenant_template"."chronic_care_enrolments" ADD CONSTRAINT "chronic_care_enrolments_exit_check" CHECK (("exited_at" IS NULL) = ("exit_reason" IS NULL));
