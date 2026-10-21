-- CreateEnum
CREATE TYPE "tenant_template"."DiagnosisKind" AS ENUM ('principal', 'secondary');

-- CreateEnum
CREATE TYPE "tenant_template"."DiagnosisContext" AS ENUM ('consultation', 'discharge', 'death');

-- CreateTable
CREATE TABLE "tenant_template"."diagnoses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "medical_record_id" UUID,
    "context" "tenant_template"."DiagnosisContext" NOT NULL,
    "kind" "tenant_template"."DiagnosisKind" NOT NULL,
    "icd10_code" VARCHAR(10) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "is_new_case" BOOLEAN NOT NULL DEFAULT true,
    "recorded_by_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."rma3_diagnosis_rubrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "section" VARCHAR(10) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "icd10_ranges" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rma3_diagnosis_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnoses_tenant_id_context_recorded_at_idx" ON "tenant_template"."diagnoses"("tenant_id", "context", "recorded_at");

-- CreateIndex
CREATE INDEX "diagnoses_patient_id_idx" ON "tenant_template"."diagnoses"("patient_id");

-- CreateIndex
CREATE INDEX "diagnoses_stay_id_idx" ON "tenant_template"."diagnoses"("stay_id");

-- CreateIndex
CREATE INDEX "rma3_diagnosis_rubrics_tenant_id_section_idx" ON "tenant_template"."rma3_diagnosis_rubrics"("tenant_id", "section");

-- CreateIndex
CREATE UNIQUE INDEX "rma3_diagnosis_rubrics_tenant_id_code_key" ON "tenant_template"."rma3_diagnosis_rubrics"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "tenant_template"."diagnoses" ADD CONSTRAINT "diagnoses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."diagnoses" ADD CONSTRAINT "diagnoses_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."diagnoses" ADD CONSTRAINT "diagnoses_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "tenant_template"."medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

