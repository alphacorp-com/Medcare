-- CreateEnum
CREATE TYPE "tenant_template"."AppointmentStatus" AS ENUM ('booked', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled');

-- CreateTable
CREATE TABLE "tenant_template"."appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "department_id" UUID,
    "appointment_type_code" VARCHAR(40),
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "tenant_template"."AppointmentStatus" NOT NULL DEFAULT 'booked',
    "reason_for_visit" TEXT,
    "notes" TEXT,
    "stay_id" UUID,
    "series_id" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."doctor_availabilities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "doctor_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "doctor_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_tenant_id_doctor_id_scheduled_at_idx" ON "tenant_template"."appointments"("tenant_id", "doctor_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_patient_id_idx" ON "tenant_template"."appointments"("tenant_id", "patient_id");

-- CreateIndex
CREATE INDEX "appointments_series_id_idx" ON "tenant_template"."appointments"("series_id");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "tenant_template"."appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_availabilities_tenant_id_doctor_id_weekday_key" ON "tenant_template"."doctor_availabilities"("tenant_id", "doctor_id", "weekday");

-- AddForeignKey
ALTER TABLE "tenant_template"."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
