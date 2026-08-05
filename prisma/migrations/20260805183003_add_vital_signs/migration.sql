-- CreateTable
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DECIMAL(4,1),
    "weight" DECIMAL(5,2),
    "height" DECIMAL(5,1),
    "spo2" INTEGER,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vital_signs_patient_id_recorded_at_idx" ON "vital_signs"("patient_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "vital_signs_stay_id_idx" ON "vital_signs"("stay_id");

-- CreateIndex
CREATE INDEX "vital_signs_tenant_id_idx" ON "vital_signs"("tenant_id");

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;
