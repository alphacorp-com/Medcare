"use client";

import { toast } from "sonner";

// Shows the "Invoice generated: X XAF" confirmation used across modules whenever a
// clinical completion action returns a non-null `billing` field from the API.
export function notifyBillingGenerated(
  billing: { amount: number; currency: string } | null | undefined,
  label: string
) {
  if (!billing) return;
  toast.success(`${label}: ${billing.amount.toLocaleString()} ${billing.currency}`);
}

// Same as notifyBillingGenerated but for hooks that return multiple lines at once
// (e.g. a multi-drug prescription), summing the total across all generated lines.
export function notifyBillingGeneratedMany(
  billing: { amount: number; currency: string }[] | null | undefined,
  label: string
) {
  if (!billing || billing.length === 0) return;
  const total = billing.reduce((sum, line) => sum + line.amount, 0);
  toast.success(`${label}: ${total.toLocaleString()} ${billing[0].currency}`);
}
