-- Third-party payment ("prises en charge"): payers, conventions with rates per family,
-- patient coverages, prior authorizations, free-care programmes, claims to payers and their
-- settlements. Additive only: existing invoices keep their amounts (coverage_status = none).

-- CreateEnum
CREATE TYPE "tenant_template"."CoverageFamily" AS ENUM ('consultation', 'laboratory', 'imaging', 'pharmacy', 'hospitalization', 'surgery', 'maternity', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."CoverageStatus" AS ENUM ('none', 'applied', 'capped', 'authorization_required', 'invalid_coverage', 'frozen');

-- CreateEnum
CREATE TYPE "tenant_template"."CoverageAuthorizationStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "tenant_template"."ExemptionEligibility" AS ENUM ('automatic', 'enrolment');

-- CreateEnum
CREATE TYPE "tenant_template"."InsuranceClaimStatus" AS ENUM ('draft', 'submitted', 'partially_settled', 'settled', 'closed');

-- CreateEnum
CREATE TYPE "tenant_template"."PayerPaymentMethod" AS ENUM ('bank_transfer', 'cheque', 'cash', 'mobile_money', 'other');

-- AlterTable
ALTER TABLE "tenant_template"."patient_invoices" ADD COLUMN     "authorization_id" UUID,
ADD COLUMN     "coverage_id" UUID,
ADD COLUMN     "coverage_status" "tenant_template"."CoverageStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "exemption_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurer_paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurer_rejected_to_patient" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenant_template"."patient_invoice_lines" ADD COLUMN     "exemption_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exemption_program_id" UUID,
ADD COLUMN     "payer_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tenant_template"."payers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "insurance_type_id" UUID,
    "contact_name" VARCHAR(150),
    "phone" VARCHAR(30),
    "email" VARCHAR(150),
    "address" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."coverage_agreements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "default_rate" INTEGER NOT NULL,
    "per_invoice_ceiling" DECIMAL(14,2),
    "annual_ceiling" DECIMAL(14,2),
    "requires_authorization" BOOLEAN NOT NULL DEFAULT false,
    "authorization_threshold" DECIMAL(14,2),
    "valid_from" DATE,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coverage_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."coverage_agreement_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "family" "tenant_template"."CoverageFamily" NOT NULL,
    "rate" INTEGER NOT NULL,

    CONSTRAINT "coverage_agreement_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."patient_coverages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "member_number" VARCHAR(60) NOT NULL,
    "principal_name" VARCHAR(150),
    "relationship" VARCHAR(40),
    "employer" VARCHAR(150),
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "ended_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patient_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."coverage_authorizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "coverage_id" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "authorized_amount" DECIMAL(14,2),
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "stay_id" UUID,
    "status" "tenant_template"."CoverageAuthorizationStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coverage_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."exemption_programs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "rate" INTEGER NOT NULL,
    "families" "tenant_template"."CoverageFamily"[],
    "act_codes" TEXT[],
    "inventory_item_ids" TEXT[],
    "eligibility" "tenant_template"."ExemptionEligibility" NOT NULL,
    "min_age_months" INTEGER,
    "max_age_months" INTEGER,
    "sex" "tenant_template"."Gender",
    "pregnant_only" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" DATE,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exemption_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."patient_exemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "reason" TEXT NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_exemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."insurance_claims" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "tenant_template"."InsuranceClaimStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."insurance_claim_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "claimed_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rejected_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rejection_reason" VARCHAR(500),
    "charged_to_patient" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insurance_claim_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."payer_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "claim_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,
    "method" "tenant_template"."PayerPaymentMethod" NOT NULL,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."payer_payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "claim_item_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payer_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payers_tenant_id_code_key" ON "tenant_template"."payers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "coverage_agreements_payer_id_idx" ON "tenant_template"."coverage_agreements"("payer_id");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_agreements_tenant_id_code_key" ON "tenant_template"."coverage_agreements"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_agreement_rates_agreement_id_family_key" ON "tenant_template"."coverage_agreement_rates"("agreement_id", "family");

-- CreateIndex
CREATE INDEX "patient_coverages_tenant_id_patient_id_idx" ON "tenant_template"."patient_coverages"("tenant_id", "patient_id");

-- CreateIndex
CREATE INDEX "patient_coverages_agreement_id_idx" ON "tenant_template"."patient_coverages"("agreement_id");

-- CreateIndex
CREATE INDEX "coverage_authorizations_tenant_id_idx" ON "tenant_template"."coverage_authorizations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_authorizations_coverage_id_number_key" ON "tenant_template"."coverage_authorizations"("coverage_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "exemption_programs_tenant_id_code_key" ON "tenant_template"."exemption_programs"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "patient_exemptions_tenant_id_patient_id_idx" ON "tenant_template"."patient_exemptions"("tenant_id", "patient_id");

-- CreateIndex
CREATE INDEX "insurance_claims_payer_id_idx" ON "tenant_template"."insurance_claims"("payer_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_tenant_id_number_key" ON "tenant_template"."insurance_claims"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "insurance_claim_items_invoice_id_idx" ON "tenant_template"."insurance_claim_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claim_items_claim_id_invoice_id_key" ON "tenant_template"."insurance_claim_items"("claim_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payer_payments_tenant_id_received_at_idx" ON "tenant_template"."payer_payments"("tenant_id", "received_at");

-- CreateIndex
CREATE INDEX "payer_payment_allocations_claim_item_id_idx" ON "tenant_template"."payer_payment_allocations"("claim_item_id");

-- CreateIndex
CREATE INDEX "patient_invoices_coverage_id_idx" ON "tenant_template"."patient_invoices"("coverage_id");

-- CreateIndex
CREATE INDEX "patient_invoices_authorization_id_idx" ON "tenant_template"."patient_invoices"("authorization_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_invoices" ADD CONSTRAINT "patient_invoices_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "tenant_template"."patient_coverages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_invoices" ADD CONSTRAINT "patient_invoices_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "tenant_template"."coverage_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_invoice_lines" ADD CONSTRAINT "patient_invoice_lines_exemption_program_id_fkey" FOREIGN KEY ("exemption_program_id") REFERENCES "tenant_template"."exemption_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."payers" ADD CONSTRAINT "payers_insurance_type_id_fkey" FOREIGN KEY ("insurance_type_id") REFERENCES "tenant_template"."reference_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."coverage_agreements" ADD CONSTRAINT "coverage_agreements_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "tenant_template"."payers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."coverage_agreement_rates" ADD CONSTRAINT "coverage_agreement_rates_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenant_template"."coverage_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_coverages" ADD CONSTRAINT "patient_coverages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_coverages" ADD CONSTRAINT "patient_coverages_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenant_template"."coverage_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."coverage_authorizations" ADD CONSTRAINT "coverage_authorizations_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "tenant_template"."patient_coverages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_exemptions" ADD CONSTRAINT "patient_exemptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."patient_exemptions" ADD CONSTRAINT "patient_exemptions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "tenant_template"."exemption_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."insurance_claims" ADD CONSTRAINT "insurance_claims_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "tenant_template"."payers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."insurance_claim_items" ADD CONSTRAINT "insurance_claim_items_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "tenant_template"."insurance_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."insurance_claim_items" ADD CONSTRAINT "insurance_claim_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tenant_template"."patient_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."payer_payments" ADD CONSTRAINT "payer_payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "tenant_template"."payers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."payer_payments" ADD CONSTRAINT "payer_payments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "tenant_template"."insurance_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."payer_payment_allocations" ADD CONSTRAINT "payer_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "tenant_template"."payer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."payer_payment_allocations" ADD CONSTRAINT "payer_payment_allocations_claim_item_id_fkey" FOREIGN KEY ("claim_item_id") REFERENCES "tenant_template"."insurance_claim_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity rules the application also checks (defence in depth).
ALTER TABLE "tenant_template"."coverage_agreements" ADD CONSTRAINT "coverage_agreements_values_check" CHECK ("default_rate" BETWEEN 0 AND 100 AND ("per_invoice_ceiling" IS NULL OR "per_invoice_ceiling" >= 0) AND ("annual_ceiling" IS NULL OR "annual_ceiling" >= 0) AND ("authorization_threshold" IS NULL OR "authorization_threshold" >= 0) AND ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_from" <= "valid_to"));
ALTER TABLE "tenant_template"."coverage_agreement_rates" ADD CONSTRAINT "coverage_agreement_rates_rate_check" CHECK ("rate" BETWEEN 0 AND 100);
ALTER TABLE "tenant_template"."patient_coverages" ADD CONSTRAINT "patient_coverages_dates_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");
ALTER TABLE "tenant_template"."coverage_authorizations" ADD CONSTRAINT "coverage_authorizations_values_check" CHECK ("valid_to" >= "valid_from" AND ("authorized_amount" IS NULL OR "authorized_amount" >= 0));
ALTER TABLE "tenant_template"."exemption_programs" ADD CONSTRAINT "exemption_programs_values_check" CHECK ("rate" BETWEEN 1 AND 100 AND ("min_age_months" IS NULL OR "min_age_months" >= 0) AND ("max_age_months" IS NULL OR "max_age_months" > 0) AND ("min_age_months" IS NULL OR "max_age_months" IS NULL OR "min_age_months" < "max_age_months") AND cardinality("families") > 0);
ALTER TABLE "tenant_template"."patient_exemptions" ADD CONSTRAINT "patient_exemptions_dates_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");
ALTER TABLE "tenant_template"."patient_invoice_lines" ADD CONSTRAINT "patient_invoice_lines_shares_check" CHECK ("payer_amount" >= 0 AND "exemption_amount" >= 0 AND "payer_amount" + "exemption_amount" <= GREATEST("amount", 0));
ALTER TABLE "tenant_template"."patient_invoices" ADD CONSTRAINT "patient_invoices_coverage_amounts_check" CHECK ("exemption_amount" >= 0 AND "insurer_paid_amount" >= 0 AND "insurer_rejected_to_patient" >= 0);
ALTER TABLE "tenant_template"."insurance_claim_items" ADD CONSTRAINT "insurance_claim_items_amounts_check" CHECK ("claimed_amount" >= 0 AND "paid_amount" >= 0 AND "rejected_amount" >= 0 AND "paid_amount" + "rejected_amount" <= "claimed_amount");
ALTER TABLE "tenant_template"."payer_payments" ADD CONSTRAINT "payer_payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "tenant_template"."payer_payment_allocations" ADD CONSTRAINT "payer_payment_allocations_amount_check" CHECK ("amount" > 0);

-- An invoice is claimed once at a time: only a fully rejected claim item frees it for another claim.
-- (Partial index: not expressible in schema.prisma, kept here and enforced again in lib/coverage/claims.ts.)
CREATE UNIQUE INDEX "insurance_claim_items_live_invoice_key" ON "tenant_template"."insurance_claim_items"("invoice_id") WHERE "rejected_amount" < "claimed_amount";
