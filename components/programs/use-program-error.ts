"use client";

import { useTranslations } from "next-intl";

// Error codes of the oxygen, nutrition, blood bank, staff, TB screening, chronic care and
// pharmacovigilance routes (lib/programs/input*, lib/blood-bank/input, lib/hr/input): translated
// when known.
const KNOWN_CODES = new Set([
  "invalid_body",
  "invalid_patient",
  "invalid_date",
  "invalid_month",
  "not_found",
  "invalid_code",
  "duplicate_code",
  "invalid_type",
  "invalid_label",
  "invalid_serialNumber",
  "invalid_location",
  "invalid_status",
  "invalid_spo2",
  "not_hypoxemia",
  "invalid_notes",
  "invalid_outcome",
  "invalid_outcome_date",
  "invalid_program",
  "invalid_admission_type",
  "invalid_criterion",
  "invalid_muac",
  "invalid_whz",
  "invalid_residency",
  "case_already_open",
  "invalid_exit_reason",
  "invalid_exit_date",
  "invalid_weight",
  "invalid_height",
  "child_over_5",
  "invalid_name",
  "invalid_sex",
  "invalid_birth_date",
  "invalid_phone",
  "invalid_blood_group",
  "invalid_donor_type",
  "invalid_donor",
  "invalid_session",
  "invalid_bag_number",
  "duplicate_bag",
  "invalid_hivResult",
  "invalid_hbvResult",
  "invalid_hcvResult",
  "invalid_syphilisResult",
  "bag_not_in_quarantine",
  "bag_not_safe",
  "bag_not_available",
  "bag_already_used",
  "bag_changed",
  "invalid_reason",
  "invalid_action",
  "invalid_cadre",
  "invalid_payer",
  "invalid_birthDate",
  "invalid_hiredAt",
  "invalid_retirementDate",
  "invalid_leftAt",
  "invalid_user",
  "lab_needs_presumptive",
  "result_needs_test",
  "second_line_needs_rr",
  "invalid_second_line_date",
  "already_enrolled",
  "enrolment_closed",
  "invalid_condition",
  "invalid_blood_pressure",
  "invalid_hba1c",
  "invalid_drug",
  "invalid_lot",
  "invalid_expiry",
  "invalid_description",
]);

export function useProgramError() {
  const t = useTranslations("programs.errors");
  const tc = useTranslations("common");
  return (error: unknown): string => {
    const code = error instanceof Error ? error.message : "";
    return KNOWN_CODES.has(code) ? t(code) : tc("unknown_error");
  };
}
