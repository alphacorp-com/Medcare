-- Mother and child (RMA3 II.1.1 - II.1.5, II.3.5-001, III.9-001): Td doses from the antenatal
-- visit, haemoglobin, outreach visits; delivery GATPA / complications managed / breastfeeding;
-- abortion care and maternal deaths (cause, review); stillbirth type, neonatal care and deaths;
-- post-natal visits; family planning visits. Additive only (new columns have defaults or are
-- nullable, new tables).
-- CreateEnum
CREATE TYPE "tenant_template"."AbortionCareType" AS ENUM ('uncomplicated', 'complicated');

-- CreateEnum
CREATE TYPE "tenant_template"."MaternalDeathCause" AS ENUM ('hemorrhage', 'obstructed_labour', 'preeclampsia_eclampsia', 'uterine_rupture', 'puerperal_infection', 'abortion', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."BreastfeedingStart" AS ENUM ('within_30_min', 'within_1_hour', 'later', 'not_started');

-- CreateEnum
CREATE TYPE "tenant_template"."StillbirthType" AS ENUM ('fresh', 'macerated');

-- CreateEnum
CREATE TYPE "tenant_template"."NeonatalDeathCause" AS ENUM ('prematurity', 'asphyxia', 'infection', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."FpClientStatus" AS ENUM ('new_user', 'continuing_user');

-- CreateEnum
CREATE TYPE "tenant_template"."FpProcedure" AS ENUM ('implant_insertion', 'implant_removal', 'iud_insertion', 'iud_removal');

-- AlterTable
ALTER TABLE "tenant_template"."pregnancies" ADD COLUMN     "abortion_care" "tenant_template"."AbortionCareType",
ADD COLUMN     "ended_at" TIMESTAMPTZ,
ADD COLUMN     "maternal_death_at" TIMESTAMPTZ,
ADD COLUMN     "maternal_death_cause" "tenant_template"."MaternalDeathCause",
ADD COLUMN     "maternal_death_reviewed_at" DATE;

-- AlterTable
ALTER TABLE "tenant_template"."antenatal_visits" ADD COLUMN     "hemoglobin_g_per_dl" DECIMAL(4,1),
ADD COLUMN     "strategy" "tenant_template"."VaccinationStrategy" NOT NULL DEFAULT 'fixed',
ADD COLUMN     "td_immunization_id" UUID;

-- AlterTable
ALTER TABLE "tenant_template"."deliveries" ADD COLUMN     "amtsl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breastfeeding_start" "tenant_template"."BreastfeedingStart",
ADD COLUMN     "complications_managed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenant_template"."newborns" ADD COLUMN     "bag_mask_ventilation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "death_cause" "tenant_template"."NeonatalDeathCause",
ADD COLUMN     "death_reviewed_at" DATE,
ADD COLUMN     "died_at" TIMESTAMPTZ,
ADD COLUMN     "incubator_care" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kangaroo_care" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stillbirth_type" "tenant_template"."StillbirthType";

-- CreateTable
CREATE TABLE "tenant_template"."postnatal_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pregnancy_id" UUID NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL,
    "vitamin_a_given" BOOLEAN NOT NULL DEFAULT false,
    "iron_folate_given" BOOLEAN NOT NULL DEFAULT false,
    "breastfeeding_counseling" BOOLEAN NOT NULL DEFAULT false,
    "newborn_examined" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "performed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postnatal_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."family_planning_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL,
    "client_status" "tenant_template"."FpClientStatus" NOT NULL,
    "counseled" BOOLEAN NOT NULL DEFAULT false,
    "method_code" VARCHAR(40),
    "procedure" "tenant_template"."FpProcedure",
    "is_postpartum" BOOLEAN NOT NULL DEFAULT false,
    "referred_by_chw" BOOLEAN NOT NULL DEFAULT false,
    "contraindications" TEXT,
    "side_effects" TEXT,
    "next_due_date" DATE,
    "notes" TEXT,
    "performed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_planning_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "postnatal_visits_tenant_id_visit_date_idx" ON "tenant_template"."postnatal_visits"("tenant_id", "visit_date");

-- CreateIndex
CREATE INDEX "postnatal_visits_pregnancy_id_idx" ON "tenant_template"."postnatal_visits"("pregnancy_id");

-- CreateIndex
CREATE INDEX "family_planning_visits_tenant_id_visit_date_idx" ON "tenant_template"."family_planning_visits"("tenant_id", "visit_date");

-- CreateIndex
CREATE INDEX "family_planning_visits_patient_id_visit_date_idx" ON "tenant_template"."family_planning_visits"("patient_id", "visit_date");

-- CreateIndex
CREATE UNIQUE INDEX "antenatal_visits_td_immunization_id_key" ON "tenant_template"."antenatal_visits"("td_immunization_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."antenatal_visits" ADD CONSTRAINT "antenatal_visits_td_immunization_id_fkey" FOREIGN KEY ("td_immunization_id") REFERENCES "tenant_template"."immunizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."postnatal_visits" ADD CONSTRAINT "postnatal_visits_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "tenant_template"."pregnancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."family_planning_visits" ADD CONSTRAINT "family_planning_visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defence in depth (the API validates first).
ALTER TABLE "tenant_template"."antenatal_visits" ADD CONSTRAINT "antenatal_visits_hemoglobin_check" CHECK ("hemoglobin_g_per_dl" IS NULL OR "hemoglobin_g_per_dl" BETWEEN 2 AND 25);
ALTER TABLE "tenant_template"."newborns" ADD CONSTRAINT "newborns_stillbirth_type_check" CHECK ("stillbirth_type" IS NULL OR "outcome" = 'stillbirth');
