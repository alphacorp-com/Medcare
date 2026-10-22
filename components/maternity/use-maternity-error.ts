"use client";

import { useTranslations } from "next-intl";

// Error codes of the mother-and-child routes (lib/maternity/input, Td stock lots): translated
// when known, otherwise the given fallback message.
const KNOWN_CODES = new Set([
  "invalid_body",
  "invalid_strategy",
  "invalid_hemoglobin",
  "invalid_td",
  "invalid_td_dose",
  "stock_lot_required",
  "lot_not_found",
  "lot_expired",
  "out_of_stock",
  "vial_config_missing",
  "invalid_complications",
  "invalid_breastfeeding",
  "invalid_maternal_outcome",
  "invalid_outcome",
  "invalid_stillbirth_type",
  "invalid_death_date",
  "invalid_death_cause",
  "invalid_review_date",
  "invalid_status",
  "pregnancy_delivered",
  "invalid_end_date",
  "invalid_abortion_care",
  "invalid_maternal_death",
  "invalid_maternal_death_cause",
  "invalid_notes",
  "invalid_date",
  "invalid_postnatal_date",
  "delivery_not_completed",
  "invalid_patient",
  "invalid_client_status",
  "invalid_method",
  "method_sex_mismatch",
  "invalid_procedure",
  "procedure_method_mismatch",
  "invalid_postpartum",
  "method_not_postpartum",
  "invalid_contraindications",
  "invalid_sideEffects",
  "invalid_next_due_date",
  "invalid_month",
]);

export function useMaternityError() {
  const t = useTranslations("maternity.errors");
  return (payload: unknown, fallback: string): string => {
    // An ApiError (message = code) or a JSON error body ({ code } or { error }).
    const code =
      payload instanceof Error
        ? payload.message
        : typeof payload === "object" && payload !== null
          ? ((payload as { code?: unknown }).code ?? (payload as { error?: unknown }).error)
          : null;
    return typeof code === "string" && KNOWN_CODES.has(code) ? t(code) : fallback;
  };
}
