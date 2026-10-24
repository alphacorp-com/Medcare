import prisma from "@/lib/prisma";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";
import { CoverageError } from "@/lib/coverage/claims";
import { refundableAmount, type PatientRefundInput } from "@/lib/coverage/input";

// A patient's overpayment on an invoice — they paid more than their share after a coverage or
// exemption applied late, a line removed, a rejection reversed, a duplicate payment, or a
// cancelled invoice — is given back or moved to another open invoice of the same patient.
// Both lower what was paid on the source invoice; a transfer records a "credit_transfer"
// payment on the target (no new money: never counted as income, lib/reports).

const n = (d: unknown) => Number(d ?? 0);

async function lockInvoices(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], ids: string[]) {
  // Id order: two transfers between the same invoices cannot deadlock.
  for (const id of [...ids].sort()) await tx.$queryRaw`SELECT id FROM "tenant_template"."patient_invoices" WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function recordPatientRefund(tenantId: string, userId: string, invoiceId: string, input: PatientRefundInput) {
  const targetId = input.kind === "transfer" ? input.targetInvoiceId : null;
  if (targetId === invoiceId) throw new CoverageError("invalid_target_invoice");
  const refund = await prisma.$transaction(async (tx) => {
    await lockInvoices(tx, targetId ? [invoiceId, targetId] : [invoiceId]);
    const source = await tx.patientInvoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!source) throw new CoverageError("not_found", 404);
    const refundable = refundableAmount({ status: source.status, paidAmount: n(source.paidAmount), patientAmount: n(source.patientAmount) });
    if (input.amount > refundable) throw new CoverageError("amount_exceeds_refundable");

    let targetPaymentId: string | null = null;
    if (input.kind === "transfer") {
      const target = await tx.patientInvoice.findFirst({ where: { id: input.targetInvoiceId, tenantId, patientId: source.patientId } });
      if (!target || target.status === "cancelled") throw new CoverageError("invalid_target_invoice");
      const due = n(target.patientAmount) - n(target.paidAmount);
      if (input.amount > due) throw new CoverageError("amount_exceeds_target_due");
      const payment = await tx.payment.create({
        data: {
          tenantId, invoiceId: target.id, amount: input.amount, method: "credit_transfer", status: "successful", currency: target.currency,
          providerReference: `TRF-${source.id.slice(0, 8).toUpperCase()}`, initiatedById: userId, initiatedAt: input.refundedAt, completedAt: input.refundedAt,
        },
      });
      await tx.patientInvoice.update({ where: { id: target.id }, data: { paidAmount: { increment: input.amount } } });
      targetPaymentId = payment.id;
    }
    await tx.patientInvoice.update({ where: { id: source.id }, data: { paidAmount: { decrement: input.amount } } });
    return tx.patientRefund.create({
      data: {
        tenantId, invoiceId: source.id, kind: input.kind, amount: input.amount,
        method: input.kind === "refund" ? input.method : null, reference: input.kind === "refund" ? input.reference : null,
        targetInvoiceId: targetId, targetPaymentId, reason: input.reason, refundedAt: input.refundedAt, recordedById: userId,
      },
    });
  });
  // Statuses (and, for the target, the release of what it held back once settled).
  await recalculateInvoiceTotals(invoiceId);
  if (targetId) await recalculateInvoiceTotals(targetId);
  return refund;
}

// Open invoices of the same patient that an overpayment can be moved to.
export async function transferTargets(tenantId: string, invoiceId: string) {
  const source = await prisma.patientInvoice.findFirst({ where: { id: invoiceId, tenantId }, select: { patientId: true } });
  if (!source) return [];
  const invoices = await prisma.patientInvoice.findMany({
    where: { tenantId, patientId: source.patientId, id: { not: invoiceId }, status: { in: ["draft", "pending_payment", "partially_paid"] } },
    select: { id: true, createdAt: true, patientAmount: true, paidAmount: true, stay: { select: { stayNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return invoices.map((i) => ({ id: i.id, createdAt: i.createdAt, stayNumber: i.stay?.stayNumber ?? null, due: n(i.patientAmount) - n(i.paidAmount) })).filter((i) => i.due > 0);
}
