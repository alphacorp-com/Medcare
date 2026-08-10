-- CreateEnum
CREATE TYPE "ReferenceCatalogType" AS ENUM ('admission_type', 'appointment_type', 'room_type', 'insurance_type', 'pharmaceutical_unit', 'imaging_type', 'anatomical_zone');

-- CreateEnum
CREATE TYPE "ExamCatalogDomain" AS ENUM ('laboratory', 'radiology');

-- AlterTable
ALTER TABLE "medication_inventory" ADD COLUMN     "storage_location_id" UUID,
ADD COLUMN     "supplier_id" UUID;

-- AlterTable
ALTER TABLE "stays" ADD COLUMN     "admission_type_id" UUID;

-- CreateTable
CREATE TABLE "reference_catalog_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "catalog_type" "ReferenceCatalogType" NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150),
    "color" VARCHAR(20),
    "icon" VARCHAR(40),
    "group" VARCHAR(80),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reference_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_act_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150),
    "color" VARCHAR(20),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medical_act_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_acts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "category_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_fr" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200),
    "base_price" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(50),
    "default_pec_coverage_percent" INTEGER NOT NULL DEFAULT 0,
    "allows_urgency_surcharge" BOOLEAN NOT NULL DEFAULT false,
    "requires_lab_validation" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medical_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_catalog_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "domain" "ExamCatalogDomain" NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exam_catalog_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_catalog_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "exam_type_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name_fr" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "price" DECIMAL(12,2),
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "imaging_catalog_item_id" UUID,
    "anatomical_zone_id" UUID,
    "requires_contrast" BOOLEAN,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exam_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(10) NOT NULL,
    "label_fr" VARCHAR(255) NOT NULL,
    "label_en" VARCHAR(255),
    "chapter" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "contact_name" VARCHAR(150),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reference_catalog_items_tenant_id_catalog_type_idx" ON "reference_catalog_items"("tenant_id", "catalog_type");

-- CreateIndex
CREATE UNIQUE INDEX "reference_catalog_items_tenant_id_catalog_type_code_key" ON "reference_catalog_items"("tenant_id", "catalog_type", "code");

-- CreateIndex
CREATE INDEX "medical_act_categories_tenant_id_idx" ON "medical_act_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_act_categories_tenant_id_code_key" ON "medical_act_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "medical_acts_tenant_id_idx" ON "medical_acts"("tenant_id");

-- CreateIndex
CREATE INDEX "medical_acts_category_id_idx" ON "medical_acts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_acts_tenant_id_code_key" ON "medical_acts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "exam_catalog_types_tenant_id_domain_idx" ON "exam_catalog_types"("tenant_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "exam_catalog_types_tenant_id_domain_code_key" ON "exam_catalog_types"("tenant_id", "domain", "code");

-- CreateIndex
CREATE INDEX "exam_catalog_entries_tenant_id_idx" ON "exam_catalog_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "exam_catalog_entries_exam_type_id_idx" ON "exam_catalog_entries"("exam_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_catalog_entries_tenant_id_code_key" ON "exam_catalog_entries"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "icd10_codes_tenant_id_idx" ON "icd10_codes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "icd10_codes_tenant_id_code_key" ON "icd10_codes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "storage_locations_tenant_id_idx" ON "storage_locations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_tenant_id_code_key" ON "storage_locations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "medical_acts" ADD CONSTRAINT "medical_acts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "medical_act_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_entries" ADD CONSTRAINT "exam_catalog_entries_exam_type_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_catalog_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
