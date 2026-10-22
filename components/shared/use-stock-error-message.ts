"use client";

import { useTranslations } from "next-intl";

// Error codes returned (with a 400/404/409) by the stock routes and by the dispensing and
// vaccination routes, which take their units from the stock (see lib/stock).
const STOCK_ERROR_CODES = [
  "insufficient_stock",
  "lot_not_found",
  "lot_expired",
  "lot_expiry_mismatch",
  "item_not_found",
  "same_location",
  "history_conflict",
  "vial_config_missing",
  "invalid_location",
  "invalid_doses_per_unit",
  "open_vial_hours_required",
  "stock_lot_required",
  "invalid_quantity",
  "invalid_lot_number",
  "invalid_expiry_date",
  "invalid_date",
  "future_date",
  "invalid_unit_cost",
  "invalid_reason",
  "reason_required",
  "invalid_loss_type",
  "invalid_lot",
  "invalid_name",
  "invalid_field",
  "invalid_threshold",
  "invalid_unit_price",
  "invalid_rma3_category",
  "invalid_rma3_treatment",
  "stock_is_read_only",
  "unknown_storage_location",
  "unknown_supplier",
  "unknown_vaccine_antigen",
] as const;

// Translates a stock error from a response body ({ code, available?, item? }) or from an
// ApiError message (which carries the code). Returns null for any other error so callers
// keep their own message.
export function useStockErrorMessage() {
  const t = useTranslations("stock.errors");
  return (bodyOrCode: unknown): string | null => {
    const body = typeof bodyOrCode === "string" ? { code: bodyOrCode } : bodyOrCode;
    if (!body || typeof body !== "object") return null;
    const { code, available, item } = body as { code?: unknown; available?: unknown; item?: unknown };
    if (typeof code !== "string" || !(STOCK_ERROR_CODES as readonly string[]).includes(code)) return null;
    return t(code, { available: typeof available === "number" ? available : 0, item: typeof item === "string" ? item : "" });
  };
}
