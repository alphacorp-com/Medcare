-- Third-party payment, second step:
--  * memberships ("adhésions"): a member number held by a person (patient or not) covering
--    beneficiaries — holder, spouse, children — with a family ceiling and a children age limit;
--  * the acts' "% PEC" becomes an optional nomenclature rate a convention can apply;
--  * claims: one claim per invoice, rejections as reversible events, payer payments that can be
--    cancelled, re-allocated or partly refunded to the payer;
--  * patient overpayments refunded or moved to another invoice.
-- Existing data is carried over (each patient coverage becomes the beneficiary of a membership
-- built from its own member number).

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE "tenant_template"."CoverageRelationship" AS ENUM ('holder', 'spouse', 'child', 'other');
CREATE TYPE "tenant_template"."PayerPaymentStatus" AS ENUM ('recorded', 'cancelled');
CREATE TYPE "tenant_template"."PatientRefundKind" AS ENUM ('refund', 'transfer');
ALTER TYPE "tenant_template"."PaymentMethod" ADD VALUE 'credit_transfer';
ALTER TYPE "tenant_template"."CoverageStatus" ADD VALUE 'age_limit_exceeded';

-- ── Acts: optional nomenclature rate ────────────────────────────────────────
ALTER TABLE "tenant_template"."medical_acts" ALTER COLUMN "default_pec_coverage_percent" DROP NOT NULL,
ALTER COLUMN "default_pec_coverage_percent" DROP DEFAULT;
-- 0 was the default of a field nothing used: it means "not set", not "0 % covered".
UPDATE "tenant_template"."medical_acts" SET "default_pec_coverage_percent" = NULL WHERE "default_pec_coverage_percent" = 0;
ALTER TABLE "tenant_template"."medical_acts" ADD CONSTRAINT "medical_acts_pec_rate_check" CHECK ("default_pec_coverage_percent" IS NULL OR "default_pec_coverage_percent" BETWEEN 0 AND 100);

-- ── Conventions ─────────────────────────────────────────────────────────────
ALTER TABLE "tenant_template"."coverage_agreements" ADD COLUMN "child_max_age_years" INTEGER,
ADD COLUMN "family_annual_ceiling" DECIMAL(14,2),
ADD COLUMN "use_nomenclature_rates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_template"."coverage_agreements" ADD CONSTRAINT "coverage_agreements_family_check" CHECK (("family_annual_ceiling" IS NULL OR "family_annual_ceiling" >= 0) AND ("child_max_age_years" IS NULL OR "child_max_age_years" BETWEEN 1 AND 99));

-- ── Memberships ─────────────────────────────────────────────────────────────
CREATE TABLE "tenant_template"."coverage_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "member_number" VARCHAR(60) NOT NULL,
    "holder_name" VARCHAR(150) NOT NULL,
    "holder_patient_id" UUID,
    "employer" VARCHAR(150),
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "ended_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "coverage_policies_pkey" PRIMARY KEY ("id")
);

-- One membership per (convention, member number) of the existing coverages. The holder is the
-- covered patient unless the coverage named a main insured (then a dependant).
INSERT INTO "tenant_template"."coverage_policies"
  ("id", "tenant_id", "agreement_id", "member_number", "holder_name", "holder_patient_id", "employer", "valid_from", "valid_to", "ended_at", "created_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), x.tenant_id, x.agreement_id, x.member_number, x.holder_name, x.holder_patient_id, x.employer, x.valid_from, x.valid_to, x.ended_at, x.created_by_id, x.created_at, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (pc.agreement_id, pc.member_number)
         pc.tenant_id, pc.agreement_id, pc.member_number,
         COALESCE(NULLIF(pc.principal_name, ''), p.last_name || ' ' || p.first_name) AS holder_name,
         CASE WHEN NULLIF(pc.principal_name, '') IS NULL THEN pc.patient_id END AS holder_patient_id,
         pc.employer, pc.valid_from, pc.valid_to, pc.ended_at, pc.created_by_id, pc.created_at
  FROM "tenant_template"."patient_coverages" pc
  JOIN "tenant_template"."patients" p ON p.id = pc.patient_id
  ORDER BY pc.agreement_id, pc.member_number, (pc.principal_name IS NULL OR pc.principal_name = '') DESC, pc.created_at
) x;

ALTER TABLE "tenant_template"."patient_coverages" RENAME COLUMN "relationship" TO "relationship_text";
ALTER TABLE "tenant_template"."patient_coverages" ADD COLUMN "policy_id" UUID,
ADD COLUMN "beneficiary_number" VARCHAR(60),
ADD COLUMN "relationship" "tenant_template"."CoverageRelationship" NOT NULL DEFAULT 'holder';

UPDATE "tenant_template"."patient_coverages" pc
SET "policy_id" = cp.id,
    "relationship" = CASE
      WHEN NULLIF(pc.principal_name, '') IS NULL THEN 'holder'
      WHEN lower(COALESCE(pc.relationship_text, '')) ~ '(enfant|fils|fille|child)' THEN 'child'
      WHEN lower(COALESCE(pc.relationship_text, '')) ~ '(conjoint|époux|epoux|épouse|epouse|spouse|mari|femme)' THEN 'spouse'
      ELSE 'other'
    END::"tenant_template"."CoverageRelationship"
FROM "tenant_template"."coverage_policies" cp
WHERE cp.agreement_id = pc.agreement_id AND cp.member_number = pc.member_number;

ALTER TABLE "tenant_template"."patient_coverages" ALTER COLUMN "policy_id" SET NOT NULL;
ALTER TABLE "tenant_template"."patient_coverages" DROP CONSTRAINT "patient_coverages_agreement_id_fkey";
DROP INDEX "tenant_template"."patient_coverages_agreement_id_idx";
ALTER TABLE "tenant_template"."patient_coverages" DROP COLUMN "agreement_id",
DROP COLUMN "employer",
DROP COLUMN "member_number",
DROP COLUMN "principal_name",
DROP COLUMN "relationship_text";

CREATE INDEX "coverage_policies_tenant_id_idx" ON "tenant_template"."coverage_policies"("tenant_id");
CREATE UNIQUE INDEX "coverage_policies_agreement_id_member_number_key" ON "tenant_template"."coverage_policies"("agreement_id", "member_number");
CREATE UNIQUE INDEX "patient_coverages_policy_id_patient_id_key" ON "tenant_template"."patient_coverages"("policy_id", "patient_id");
ALTER TABLE "tenant_template"."coverage_policies" ADD CONSTRAINT "coverage_policies_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "tenant_template"."coverage_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_template"."coverage_policies" ADD CONSTRAINT "coverage_policies_holder_patient_id_fkey" FOREIGN KEY ("holder_patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_template"."patient_coverages" ADD CONSTRAINT "patient_coverages_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "tenant_template"."coverage_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_template"."coverage_policies" ADD CONSTRAINT "coverage_policies_dates_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");

-- ── Claims: rejections as events, one claim per invoice ─────────────────────
CREATE TABLE "tenant_template"."insurance_claim_rejections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "claim_item_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "charged_to_patient" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMPTZ,
    "reversed_by_id" UUID,
    "reversal_reason" VARCHAR(500),
    CONSTRAINT "insurance_claim_rejections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "insurance_claim_rejections_amount_check" CHECK ("amount" > 0)
);
-- The rejections recorded so far (one aggregate per item) become one event each.
INSERT INTO "tenant_template"."insurance_claim_rejections" ("id", "tenant_id", "claim_item_id", "amount", "reason", "charged_to_patient", "recorded_by_id", "created_at")
SELECT gen_random_uuid(), i.tenant_id, i.id, i.rejected_amount, COALESCE(NULLIF(i.rejection_reason, ''), 'Rejet'), i.charged_to_patient, c.created_by_id, i.updated_at
FROM "tenant_template"."insurance_claim_items" i
JOIN "tenant_template"."insurance_claims" c ON c.id = i.claim_id
WHERE i.rejected_amount > 0;
CREATE INDEX "insurance_claim_rejections_claim_item_id_idx" ON "tenant_template"."insurance_claim_rejections"("claim_item_id");
ALTER TABLE "tenant_template"."insurance_claim_rejections" ADD CONSTRAINT "insurance_claim_rejections_claim_item_id_fkey" FOREIGN KEY ("claim_item_id") REFERENCES "tenant_template"."insurance_claim_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_template"."insurance_claim_items" DROP COLUMN "charged_to_patient",
DROP COLUMN "rejection_reason";
DROP INDEX "tenant_template"."insurance_claim_items_live_invoice_key";
DROP INDEX "tenant_template"."insurance_claim_items_invoice_id_idx";
DROP INDEX "tenant_template"."insurance_claim_items_claim_id_invoice_id_key";
CREATE UNIQUE INDEX "insurance_claim_items_invoice_id_key" ON "tenant_template"."insurance_claim_items"("invoice_id");

-- ── Payer payments: cancellation, reversible allocations, refunds to the payer ──
ALTER TABLE "tenant_template"."payer_payments" ADD COLUMN "cancel_reason" VARCHAR(500),
ADD COLUMN "cancelled_at" TIMESTAMPTZ,
ADD COLUMN "status" "tenant_template"."PayerPaymentStatus" NOT NULL DEFAULT 'recorded';
ALTER TABLE "tenant_template"."payer_payment_allocations" ADD COLUMN "reversed_at" TIMESTAMPTZ,
ADD COLUMN "reversed_by_id" UUID;

CREATE TABLE "tenant_template"."payer_payment_refunds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "refunded_at" TIMESTAMPTZ NOT NULL,
    "reference" VARCHAR(120),
    "reason" VARCHAR(500) NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payer_payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payer_payment_refunds_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "payer_payment_refunds_tenant_id_refunded_at_idx" ON "tenant_template"."payer_payment_refunds"("tenant_id", "refunded_at");
ALTER TABLE "tenant_template"."payer_payment_refunds" ADD CONSTRAINT "payer_payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "tenant_template"."payer_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Patient overpayments: refunds and transfers ─────────────────────────────
CREATE TABLE "tenant_template"."patient_refunds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "kind" "tenant_template"."PatientRefundKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "tenant_template"."PaymentMethod",
    "reference" VARCHAR(120),
    "target_invoice_id" UUID,
    "target_payment_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "refunded_at" TIMESTAMPTZ NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "patient_refunds_amount_check" CHECK ("amount" > 0),
    -- A refund says how the money was given back; a transfer says where it went.
    CONSTRAINT "patient_refunds_kind_check" CHECK (("kind" = 'refund' AND "method" IS NOT NULL AND "target_invoice_id" IS NULL) OR ("kind" = 'transfer' AND "target_invoice_id" IS NOT NULL AND "target_invoice_id" <> "invoice_id"))
);
CREATE UNIQUE INDEX "patient_refunds_target_payment_id_key" ON "tenant_template"."patient_refunds"("target_payment_id");
CREATE INDEX "patient_refunds_tenant_id_refunded_at_idx" ON "tenant_template"."patient_refunds"("tenant_id", "refunded_at");
CREATE INDEX "patient_refunds_invoice_id_idx" ON "tenant_template"."patient_refunds"("invoice_id");
ALTER TABLE "tenant_template"."patient_refunds" ADD CONSTRAINT "patient_refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tenant_template"."patient_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_template"."patient_refunds" ADD CONSTRAINT "patient_refunds_target_invoice_id_fkey" FOREIGN KEY ("target_invoice_id") REFERENCES "tenant_template"."patient_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What the patient paid can never go negative once refunds are taken out.
ALTER TABLE "tenant_template"."patient_invoices" ADD CONSTRAINT "patient_invoices_paid_non_negative" CHECK ("paid_amount" >= 0);
