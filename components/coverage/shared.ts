"use client";

import { useTranslations } from "next-intl";
import { COVERAGE_FAMILIES } from "@/lib/coverage/compute";

// Client helpers of the third-party payment screens.

export { COVERAGE_FAMILIES };

// Error codes of the coverage / claims routes (lib/coverage): translated when known.
const KNOWN_CODES = new Set([
  "invalid_body", "invalid_code", "invalid_name", "invalid_insurance_type", "invalid_email", "invalid_contactName", "invalid_phone", "invalid_address",
  "invalid_payer", "invalid_rate", "invalid_rates", "invalid_perInvoiceCeiling", "invalid_annualCeiling", "invalid_authorizationThreshold", "invalid_dates", "invalid_notes",
  "invalid_agreement", "invalid_member_number", "invalid_principalName", "invalid_relationship", "invalid_employer", "coverage_ended",
  "invalid_number", "invalid_amount", "invalid_stay", "invalid_status", "authorization_cancelled",
  "invalid_families", "invalid_act_codes", "invalid_articles", "invalid_eligibility", "invalid_age", "invalid_sex",
  "invalid_program", "invalid_reason", "exemption_revoked",
  "invalid_period", "invalid_invoices", "invalid_claim", "invalid_date", "invalid_method", "invalid_allocations", "allocations_exceed_payment",
  "claim_not_found", "claim_not_draft", "claim_empty", "claim_not_settled", "claim_not_submitted", "item_not_found", "amount_exceeds_outstanding",
  "invoice_not_for_payer", "invoice_not_claimable", "stay_in_progress", "invoice_already_claimed", "invoice_claimed", "invoice_cancelled",
  "invalid_coverage", "invalid_authorization", "insurance_via_claims", "insurance_amount_from_coverage", "duplicate", "not_found",
  // Memberships and beneficiaries.
  "invalid_child_age", "invalid_holder_name", "invalid_holder", "invalid_relationship", "invalid_beneficiaryNumber", "invalid_policy", "policy_ended",
  "holder_mismatch", "holder_exists", "dates_outside_policy", "already_beneficiary", "member_number_exists", "invalid_pec_rate",
  // Reversals, payer settlements, patient overpayments.
  "claim_closed", "rejection_not_found", "rejection_reversed", "payment_not_found", "payment_cancelled", "nothing_unallocated", "allocation_not_found",
  "allocation_reversed", "amount_exceeds_unallocated", "payment_in_use", "invalid_reference", "invalid_target_invoice", "invalid_kind",
  "amount_exceeds_refundable", "amount_exceeds_target_due",
]);

export function useCoverageError() {
  const t = useTranslations("coverage.errors");
  const tc = useTranslations("common");
  return (error: unknown): string => {
    const code = error instanceof Error ? error.message : "";
    return KNOWN_CODES.has(code) ? t(code) : tc("unknown_error");
  };
}

export const money = (value: number | string | null | undefined, currency = "XAF") => `${Math.round(Number(value ?? 0)).toLocaleString("fr-FR")} ${currency}`;

// <input type="date"> value of an ISO date / timestamp.
export const dateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

// Optional whole amount typed in a field: "" → null.
export const optionalAmount = (value: string) => (value.trim() === "" ? null : Number(value));
