-- CreateEnum
CREATE TYPE "tenant_template"."PregnancyStatus" AS ENUM ('ongoing', 'delivered', 'miscarried', 'terminated');

-- CreateEnum
CREATE TYPE "tenant_template"."DeliveryMode" AS ENUM ('vaginal', 'assisted_vaginal', 'cesarean');

-- AlterEnum
ALTER TYPE "tenant_template"."DepartmentType" ADD VALUE 'maternity';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tenant_template"."MedicalRecordType" ADD VALUE 'antenatal_note';
ALTER TYPE "tenant_template"."MedicalRecordType" ADD VALUE 'delivery_report';

-- AlterTable
ALTER TABLE "tenant_template"."exam_requests" ADD COLUMN     "pregnancy_id" UUID;

-- CreateTable
CREATE TABLE "tenant_template"."pregnancies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "last_menstrual_period" DATE NOT NULL,
    "expected_due_date" DATE NOT NULL,
    "gravida" INTEGER NOT NULL,
    "para" INTEGER NOT NULL,
    "status" "tenant_template"."PregnancyStatus" NOT NULL DEFAULT 'ongoing',
    "risk_factors" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pregnancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."antenatal_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "pregnancy_id" UUID NOT NULL,
    "visit_number" INTEGER NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gestational_age_weeks" INTEGER NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "weight" DECIMAL(5,2),
    "fundal_height_cm" DECIMAL(4,1),
    "fetal_heart_rate" INTEGER,
    "iron_folate_given" BOOLEAN NOT NULL DEFAULT false,
    "tetanus_vaccine_given" BOOLEAN NOT NULL DEFAULT false,
    "malaria_prevention_given" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "antenatal_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "pregnancy_id" UUID NOT NULL,
    "stay_id" UUID,
    "delivery_date" TIMESTAMPTZ,
    "mode" "tenant_template"."DeliveryMode",
    "attended_by_id" UUID,
    "complications" JSONB NOT NULL DEFAULT '[]',
    "maternal_outcome" TEXT,
    "placenta_delivered" BOOLEAN NOT NULL DEFAULT false,
    "blood_loss_ml" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."partograph_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "delivery_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cervical_dilation_cm" INTEGER,
    "fetal_heart_rate" INTEGER,
    "contractions_per_10min" INTEGER,
    "contraction_duration_sec" INTEGER,
    "maternal_pulse" INTEGER,
    "maternal_bp_systolic" INTEGER,
    "maternal_bp_diastolic" INTEGER,
    "amniotic_fluid" TEXT,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "partograph_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."newborns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "delivery_id" UUID NOT NULL,
    "patient_id" UUID,
    "sex" "tenant_template"."Gender" NOT NULL,
    "birth_weight_grams" INTEGER,
    "apgar_score_1min" INTEGER,
    "apgar_score_5min" INTEGER,
    "vitamin_k_given" BOOLEAN NOT NULL DEFAULT false,
    "resuscitation_needed" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT NOT NULL DEFAULT 'alive',
    "notes" TEXT,

    CONSTRAINT "newborns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pregnancies_tenant_id_idx" ON "tenant_template"."pregnancies"("tenant_id");

-- CreateIndex
CREATE INDEX "pregnancies_patient_id_idx" ON "tenant_template"."pregnancies"("patient_id");

-- CreateIndex
CREATE INDEX "antenatal_visits_tenant_id_idx" ON "tenant_template"."antenatal_visits"("tenant_id");

-- CreateIndex
CREATE INDEX "antenatal_visits_pregnancy_id_visit_date_idx" ON "tenant_template"."antenatal_visits"("pregnancy_id", "visit_date");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_pregnancy_id_key" ON "tenant_template"."deliveries"("pregnancy_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_stay_id_key" ON "tenant_template"."deliveries"("stay_id");

-- CreateIndex
CREATE INDEX "deliveries_tenant_id_idx" ON "tenant_template"."deliveries"("tenant_id");

-- CreateIndex
CREATE INDEX "partograph_entries_delivery_id_recorded_at_idx" ON "tenant_template"."partograph_entries"("delivery_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "newborns_patient_id_key" ON "tenant_template"."newborns"("patient_id");

-- CreateIndex
CREATE INDEX "exam_requests_pregnancy_id_idx" ON "tenant_template"."exam_requests"("pregnancy_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."pregnancies" ADD CONSTRAINT "pregnancies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."antenatal_visits" ADD CONSTRAINT "antenatal_visits_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "tenant_template"."pregnancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."deliveries" ADD CONSTRAINT "deliveries_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "tenant_template"."pregnancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."deliveries" ADD CONSTRAINT "deliveries_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."partograph_entries" ADD CONSTRAINT "partograph_entries_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "tenant_template"."deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."newborns" ADD CONSTRAINT "newborns_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "tenant_template"."deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."newborns" ADD CONSTRAINT "newborns_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."exam_requests" ADD CONSTRAINT "exam_requests_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "tenant_template"."pregnancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
