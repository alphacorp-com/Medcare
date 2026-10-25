import { Prisma, type Payment } from "@prisma/client";
import prisma from "@/lib/prisma";
import { applySuccessfulPayment } from "@/lib/billing/applyPayment";
import { getMobileMoneyConfig, resolveMtnConfig, resolveOrangeConfig } from "./config";
import { checkMtnPaymentStatus } from "./mobile-money/mtn";
import { checkOrangePaymentStatus } from "./mobile-money/orange";
import type { PaymentStatusResult } from "./mobile-money/types";

// Settles a pending mobile money payment from its status as reported by the provider's own
// API — the only source trusted. A webhook body or a status poll is merely a cue to ask the
// provider: a forged callback can therefore never mark a payment successful.
//
// The pending → final transition is a conditional update, so the webhook and the status poll
// arriving together settle the payment (and credit the invoice) exactly once.

async function providerStatus(payment: Payment): Promise<PaymentStatusResult | null> {
  if (!payment.tenantId || !payment.providerReference) return null;
  const stored = await getMobileMoneyConfig(payment.tenantId);

  if (payment.method === "mobile_money_orange") {
    const config = resolveOrangeConfig(stored);
    if (!config) return null;
    return checkOrangePaymentStatus(config, {
      orderId: payment.id,
      amount: Number(payment.amount),
      payToken: payment.providerReference,
    });
  }
  if (payment.method === "mobile_money_mtn") {
    const config = resolveMtnConfig(stored);
    if (!config) return null;
    return checkMtnPaymentStatus(config, payment.providerReference);
  }
  return null;
}

// Returns the payment as it stands afterwards (unchanged while the provider says pending).
export async function refreshMobileMoneyPayment(payment: Payment): Promise<Payment> {
  if (payment.status !== "pending") return payment;

  const result = await providerStatus(payment);
  if (!result || result.status === "pending") return payment;

  const label = payment.method === "mobile_money_orange" ? "Orange Money" : "MTN MoMo";
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "pending" },
    data: {
      status: result.status,
      rawResponse: result.raw as Prisma.InputJsonValue,
      completedAt: new Date(),
      failureReason: result.status === "failed" ? `${label} reported a failed transaction` : null,
    },
  });

  // Only the request that moved it out of "pending" credits the invoice.
  if (claimed.count === 1 && result.status === "successful") {
    await applySuccessfulPayment(payment.invoiceId, Number(payment.amount));
  }

  return (await prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
}
