/*
  Warnings:

  - You are about to drop the `billing_stays` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BillingSourceType" AS ENUM ('consultation', 'exam', 'surgery', 'pharmacy_dispensation', 'antenatal_visit', 'delivery', 'other');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('draft', 'pending_payment', 'partially_paid', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'insurance', 'mobile_money_orange', 'mobile_money_mtn', 'bank_transfer');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'successful', 'failed', 'cancelled');

-- DropForeignKey
ALTER TABLE "billing_stays" DROP CONSTRAINT "billing_stays_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "billing_stays" DROP CONSTRAINT "billing_stays_stay_id_fkey";

-- DropTable
DROP TABLE "billing_stays";

-- DropEnum
DROP TYPE "BillingStayStatus";

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "source_type" "BillingSourceType" NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "insurance_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "patient_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(6) NOT NULL DEFAULT 'XAF',
    "issued_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patient_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_invoice_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "invoice_id" UUID NOT NULL,
    "source_type" "BillingSourceType" NOT NULL,
    "source_id" VARCHAR(160),
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "currency" VARCHAR(6) NOT NULL DEFAULT 'XAF',
    "phone_number" VARCHAR(20),
    "provider_reference" VARCHAR(120),
    "raw_response" JSONB,
    "failure_reason" TEXT,
    "initiated_by_id" UUID NOT NULL,
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_schedules_tenant_id_idx" ON "fee_schedules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_tenant_id_source_type_code_key" ON "fee_schedules"("tenant_id", "source_type", "code");

-- CreateIndex
CREATE INDEX "patient_invoices_tenant_id_idx" ON "patient_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_invoices_patient_id_idx" ON "patient_invoices"("patient_id");

-- CreateIndex
CREATE INDEX "patient_invoices_stay_id_idx" ON "patient_invoices"("stay_id");

-- CreateIndex
CREATE INDEX "patient_invoices_status_idx" ON "patient_invoices"("status");

-- CreateIndex
CREATE INDEX "patient_invoice_lines_invoice_id_idx" ON "patient_invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_invoice_lines_source_type_source_id_key" ON "patient_invoice_lines"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_provider_reference_idx" ON "payments"("provider_reference");

-- AddForeignKey
ALTER TABLE "patient_invoices" ADD CONSTRAINT "patient_invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_invoices" ADD CONSTRAINT "patient_invoices_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_invoice_lines" ADD CONSTRAINT "patient_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "patient_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "patient_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
