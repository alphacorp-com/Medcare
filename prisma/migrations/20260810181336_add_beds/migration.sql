-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('available', 'occupied', 'maintenance', 'reserved');

-- CreateTable
CREATE TABLE "beds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "department_id" UUID NOT NULL,
    "room_type_id" UUID,
    "status" "BedStatus" NOT NULL DEFAULT 'available',
    "current_stay_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beds_tenant_id_idx" ON "beds"("tenant_id");

-- CreateIndex
CREATE INDEX "beds_tenant_id_department_id_idx" ON "beds"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "beds_tenant_id_status_idx" ON "beds"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_tenant_id_code_key" ON "beds"("tenant_id", "code");
