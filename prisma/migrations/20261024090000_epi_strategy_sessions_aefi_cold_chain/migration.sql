-- EPI: strategy (fixed / outreach) and population status on each dose, vaccination
-- sessions, AEFI (MAPI) reports tied to the dose, cold chain equipment and readings.
-- Doses recorded before this migration get strategy 'fixed' and population 'general'
-- (the information was not captured): the RMA3 of past months reports them that way.

-- CreateEnum
CREATE TYPE "tenant_template"."VaccinationStrategy" AS ENUM ('fixed', 'outreach');

-- CreateEnum
CREATE TYPE "tenant_template"."PopulationGroup" AS ENUM ('general', 'nomad', 'pygmy', 'refugee');

-- CreateEnum
CREATE TYPE "tenant_template"."VaccinationSessionStatus" AS ENUM ('planned', 'held', 'cancelled');

-- CreateEnum
CREATE TYPE "tenant_template"."AefiSeriousness" AS ENUM ('minor', 'serious');

-- CreateEnum
CREATE TYPE "tenant_template"."AefiOutcome" AS ENUM ('unknown', 'recovering', 'recovered', 'sequelae', 'death');

-- CreateEnum
CREATE TYPE "tenant_template"."ColdChainEquipmentType" AS ENUM ('refrigerator', 'freezer', 'cold_box', 'vaccine_carrier');

-- CreateEnum
CREATE TYPE "tenant_template"."ColdChainEquipmentStatus" AS ENUM ('functional', 'needs_repair', 'out_of_service');

-- AlterTable
ALTER TABLE "tenant_template"."immunizations" ADD COLUMN     "population_group" "tenant_template"."PopulationGroup" NOT NULL DEFAULT 'general',
ADD COLUMN     "session_id" UUID,
ADD COLUMN     "strategy" "tenant_template"."VaccinationStrategy" NOT NULL DEFAULT 'fixed';

-- CreateTable
CREATE TABLE "tenant_template"."vaccination_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "strategy" "tenant_template"."VaccinationStrategy" NOT NULL,
    "site" VARCHAR(150) NOT NULL,
    "status" "tenant_template"."VaccinationSessionStatus" NOT NULL DEFAULT 'planned',
    "held_at" TIMESTAMPTZ,
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vaccination_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."aefi_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "immunization_id" UUID NOT NULL,
    "onset_at" TIMESTAMPTZ NOT NULL,
    "seriousness" "tenant_template"."AefiSeriousness" NOT NULL,
    "outcome" "tenant_template"."AefiOutcome" NOT NULL DEFAULT 'unknown',
    "hospitalized" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(2000) NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "aefi_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."cold_chain_equipment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "type" "tenant_template"."ColdChainEquipmentType" NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "location_id" UUID,
    "min_temp_c" DECIMAL(4,1) NOT NULL,
    "max_temp_c" DECIMAL(4,1) NOT NULL,
    "status" "tenant_template"."ColdChainEquipmentStatus" NOT NULL DEFAULT 'functional',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cold_chain_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."cold_chain_readings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL,
    "temperature_c" DECIMAL(4,1) NOT NULL,
    "notes" VARCHAR(255),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cold_chain_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vaccination_sessions_tenant_id_scheduled_date_idx" ON "tenant_template"."vaccination_sessions"("tenant_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "aefi_reports_tenant_id_onset_at_idx" ON "tenant_template"."aefi_reports"("tenant_id", "onset_at");

-- CreateIndex
CREATE INDEX "aefi_reports_immunization_id_idx" ON "tenant_template"."aefi_reports"("immunization_id");

-- CreateIndex
CREATE INDEX "cold_chain_equipment_tenant_id_idx" ON "tenant_template"."cold_chain_equipment"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cold_chain_equipment_tenant_id_code_key" ON "tenant_template"."cold_chain_equipment"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "cold_chain_readings_tenant_id_read_at_idx" ON "tenant_template"."cold_chain_readings"("tenant_id", "read_at");

-- CreateIndex
CREATE INDEX "cold_chain_readings_equipment_id_read_at_idx" ON "tenant_template"."cold_chain_readings"("equipment_id", "read_at");

-- AddForeignKey
ALTER TABLE "tenant_template"."immunizations" ADD CONSTRAINT "immunizations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant_template"."vaccination_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."aefi_reports" ADD CONSTRAINT "aefi_reports_immunization_id_fkey" FOREIGN KEY ("immunization_id") REFERENCES "tenant_template"."immunizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."cold_chain_readings" ADD CONSTRAINT "cold_chain_readings_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "tenant_template"."cold_chain_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity
ALTER TABLE "tenant_template"."cold_chain_equipment" ADD CONSTRAINT "cold_chain_equipment_range_valid" CHECK ("min_temp_c" < "max_temp_c" AND "min_temp_c" >= -60 AND "max_temp_c" <= 60);
ALTER TABLE "tenant_template"."cold_chain_readings" ADD CONSTRAINT "cold_chain_readings_temperature_valid" CHECK ("temperature_c" BETWEEN -60 AND 60);
