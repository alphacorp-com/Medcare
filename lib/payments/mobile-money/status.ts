import type { PaymentStatusResult } from "./types";

// Provider status → our Payment status. Pure, unit-tested in status.test.ts.
// Anything not explicitly final stays "pending": an unknown or intermediate value must never
// settle an invoice, nor fail a payment the payer may still complete.

// Orange Money Web Payment transactionstatus: INITIATED, PENDING, EXPIRED, SUCCESS, FAILED.
export function mapOrangeStatus(status: unknown): PaymentStatusResult["status"] {
  if (status === "SUCCESS") return "successful";
  if (status === "FAILED" || status === "EXPIRED") return "failed";
  return "pending";
}

// MTN MoMo requesttopay: PENDING, SUCCESSFUL, FAILED.
export function mapMtnStatus(status: unknown): PaymentStatusResult["status"] {
  if (status === "SUCCESSFUL") return "successful";
  if (status === "FAILED") return "failed";
  return "pending";
}
