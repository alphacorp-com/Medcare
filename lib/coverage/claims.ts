import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";
import { allocateOldestFirst, type ClaimCreateInput, type PayerPaymentInput, type PayerRefundInput, type RejectionInput } from "@/lib/coverage/input";

// Receivables on payers: claim batches ("bordereaux"), rejections and payer settlements.
// Every function is scoped to the tenant it is given (the session's) and runs in a
// transaction that locks the rows it changes, so two cashiers cannot settle the same item twice.
//
// Lifecycle of a claim: draft (invoices can be added / removed) → submitted (sent to the
// payer, frozen) → partially_settled / settled as settlements and rejections come in →
// closed once nothing is left outstanding. Until it is closed every step can be undone:
// a rejection reversed (the payer finally pays), an allocation reversed (wrong invoice), a
// settlement re-allocated, partly refunded to the payer, or cancelled when recorded by mistake.
// An invoice is claimed once: a rejected part is reversed and settled on the same item.
//
// Amounts kept on rows (item.paidAmount / rejectedAmount, invoice.insurerPaidAmount /
// insurerRejectedToPatient) are the sums of the active events, maintained here only.

type Tx = Prisma.TransactionClient;

export class CoverageError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
export const outstandingOf = (item: { claimedAmount: Prisma.Decimal | number; paidAmount: Prisma.Decimal | number; rejectedAmount: Prisma.Decimal | number }) =>
  n(item.claimedAmount) - n(item.paidAmount) - n(item.rejectedAmount);

// Claims that still accept settlements, rejections and reversals.
const OPEN_STATUSES = ["submitted", "partially_settled", "settled"] as const;

async function lockClaim(tx: Tx, tenantId: string, claimId: string) {
  await tx.$queryRaw`SELECT id FROM "tenant_template"."insurance_claims" WHERE id = ${claimId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
  const claim = await tx.insuranceClaim.findFirst({ where: { id: claimId, tenantId }, include: { items: true } });
  if (!claim) throw new CoverageError("claim_not_found", 404);
  return claim;
}

async function lockPayment(tx: Tx, tenantId: string, paymentId: string) {
  await tx.$queryRaw`SELECT id FROM "tenant_template"."payer_payments" WHERE id = ${paymentId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
  const payment = await tx.payerPayment.findFirst({
    where: { id: paymentId, tenantId },
    include: { allocations: { where: { reversedAt: null }, select: { amount: true } }, refunds: { select: { amount: true } } },
  });
  if (!payment) throw new CoverageError("payment_not_found", 404);
  const allocated = payment.allocations.reduce((s, a) => s + n(a.amount), 0);
  const refunded = payment.refunds.reduce((s, r) => s + n(r.amount), 0);
  return { payment, allocated, refunded, unallocated: n(payment.amount) - allocated - refunded };
}

// Invoices a claim can take: the payer's share is due on them, the care is over (no stay, or
// a stay that ended), they are not cancelled and not already claimed.
export async function eligibleInvoices(tenantId: string, payerId: string, start: Date, end: Date) {
  return prisma.patientInvoice.findMany({
    where: {
      tenantId, status: { not: "cancelled" }, insuranceAmount: { gt: 0 }, claimItems: { none: {} },
      createdAt: { gte: start, lt: new Date(end.getTime() + 86_400_000) },
      coverage: { policy: { agreement: { payerId } } },
      OR: [{ stayId: null }, { stay: { status: { in: ["discharged", "transferred", "deceased"] } } }],
    },
    include: {
      patient: { select: { firstName: true, lastName: true, ipp: true } },
      coverage: { select: { relationship: true, beneficiaryNumber: true, policy: { select: { memberNumber: true, holderName: true, agreement: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function nextClaimNumber(tx: Tx, tenantId: string, at: Date) {
  const prefix = `BRD-${at.getUTCFullYear()}${String(at.getUTCMonth() + 1).padStart(2, "0")}-`;
  const count = await tx.insuranceClaim.count({ where: { tenantId, number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

// Adds invoices to a draft claim: each must be eligible for this payer. Rows are locked in id
// order, so two claims built concurrently from the same invoices cannot deadlock.
async function addInvoices(tx: Tx, tenantId: string, claim: { id: string; payerId: string }, invoiceIds: string[]) {
  for (const invoiceId of [...invoiceIds].sort()) {
    await tx.$queryRaw`SELECT id FROM "tenant_template"."patient_invoices" WHERE id = ${invoiceId}::uuid FOR UPDATE`;
    const invoice = await tx.patientInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { coverage: { select: { policy: { select: { agreement: { select: { payerId: true } } } } } }, stay: { select: { status: true } }, _count: { select: { claimItems: true } } },
    });
    if (!invoice || invoice.coverage?.policy.agreement.payerId !== claim.payerId) throw new CoverageError("invoice_not_for_payer");
    if (invoice.status === "cancelled" || n(invoice.insuranceAmount) <= 0) throw new CoverageError("invoice_not_claimable");
    if (invoice.stay && !["discharged", "transferred", "deceased"].includes(invoice.stay.status)) throw new CoverageError("stay_in_progress");
    if (invoice._count.claimItems > 0) throw new CoverageError("invoice_already_claimed");
    await tx.insuranceClaimItem.create({ data: { tenantId, claimId: claim.id, invoiceId, claimedAmount: invoice.insuranceAmount } });
    await tx.patientInvoice.update({ where: { id: invoiceId }, data: { coverageStatus: "frozen" } });
  }
}

export async function createClaim(tenantId: string, userId: string, input: ClaimCreateInput) {
  return prisma.$transaction(
    async (tx) => {
      const payer = await tx.payer.findFirst({ where: { id: input.payerId, tenantId }, select: { id: true } });
      if (!payer) throw new CoverageError("invalid_payer");
      const claim = await tx.insuranceClaim.create({
        data: { tenantId, payerId: payer.id, number: await nextClaimNumber(tx, tenantId, new Date()), periodStart: input.periodStart, periodEnd: input.periodEnd, notes: input.notes, createdById: userId },
      });
      await addInvoices(tx, tenantId, claim, input.invoiceIds);
      return claim;
    },
    { timeout: 30_000 }
  );
}

export async function addClaimInvoices(tenantId: string, claimId: string, invoiceIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    if (claim.status !== "draft") throw new CoverageError("claim_not_draft");
    await addInvoices(tx, tenantId, claim, invoiceIds);
  }, { timeout: 30_000 });
}

// Removing an invoice from a draft unfreezes it: its shares are recomputed.
export async function removeClaimItem(tenantId: string, claimId: string, itemId: string) {
  const invoiceId = await prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    if (claim.status !== "draft") throw new CoverageError("claim_not_draft");
    const item = claim.items.find((i) => i.id === itemId);
    if (!item) throw new CoverageError("item_not_found", 404);
    await tx.insuranceClaimItem.delete({ where: { id: item.id } });
    return item.invoiceId;
  });
  await recalculateInvoiceTotals(invoiceId);
}

export async function submitClaim(tenantId: string, claimId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    if (claim.status !== "draft") throw new CoverageError("claim_not_draft");
    if (claim.items.length === 0) throw new CoverageError("claim_empty");
    return tx.insuranceClaim.update({ where: { id: claim.id }, data: { status: "submitted", submittedAt: new Date() } });
  });
}

// A draft claim can be deleted: its invoices are released and recomputed.
export async function deleteDraftClaim(tenantId: string, claimId: string) {
  const invoiceIds = await prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    if (claim.status !== "draft") throw new CoverageError("claim_not_draft");
    await tx.insuranceClaim.delete({ where: { id: claim.id } });
    return claim.items.map((i) => i.invoiceId);
  });
  for (const id of invoiceIds) await recalculateInvoiceTotals(id);
}

// Re-derives the status from the items: settled when nothing is outstanding, partially settled
// once something was settled or rejected — in both directions (a reversal reopens a settled claim).
async function refreshClaimStatus(tx: Tx, claimId: string) {
  const claim = await tx.insuranceClaim.findUniqueOrThrow({ where: { id: claimId }, include: { items: true } });
  if (claim.status === "draft" || claim.status === "closed") return;
  const outstanding = claim.items.reduce((s, i) => s + outstandingOf(i), 0);
  const touched = claim.items.some((i) => n(i.paidAmount) > 0 || n(i.rejectedAmount) > 0);
  const status = outstanding <= 0 ? "settled" : touched ? "partially_settled" : "submitted";
  if (status !== claim.status) await tx.insuranceClaim.update({ where: { id: claimId }, data: { status } });
}

export async function closeClaim(tenantId: string, claimId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    if (claim.status !== "settled") throw new CoverageError("claim_not_settled");
    return tx.insuranceClaim.update({ where: { id: claim.id }, data: { status: "closed", closedAt: new Date() } });
  });
}

const assertOpen = (status: string) => {
  if (status === "closed") throw new CoverageError("claim_closed");
  if (!(OPEN_STATUSES as readonly string[]).includes(status)) throw new CoverageError("claim_not_submitted");
};

// The payer refuses (part of) an item. Charged back to the patient, it is added to what the
// patient owes on the invoice; otherwise the facility writes it off.
export async function recordRejection(tenantId: string, userId: string, claimId: string, itemId: string, input: RejectionInput) {
  const invoiceId = await prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    assertOpen(claim.status);
    const item = claim.items.find((i) => i.id === itemId);
    if (!item) throw new CoverageError("item_not_found", 404);
    if (input.amount > outstandingOf(item)) throw new CoverageError("amount_exceeds_outstanding");
    await tx.insuranceClaimRejection.create({ data: { tenantId, claimItemId: item.id, amount: input.amount, reason: input.reason, chargedToPatient: input.chargeToPatient, recordedById: userId } });
    await tx.insuranceClaimItem.update({ where: { id: item.id }, data: { rejectedAmount: { increment: input.amount } } });
    if (input.chargeToPatient) await tx.patientInvoice.update({ where: { id: item.invoiceId }, data: { insurerRejectedToPatient: { increment: input.amount } } });
    await refreshClaimStatus(tx, claim.id);
    return item.invoiceId;
  });
  // The patient's share may have grown (charged back).
  await recalculateInvoiceTotals(invoiceId);
}

// Undoes a rejection (recorded by mistake, or the payer pays after all): the amount is due by
// the payer again; if it had been charged back to the patient, the patient no longer owes it
// (what they already paid of it becomes an overpayment, refunded through lib/billing/refunds.ts).
export async function reverseRejection(tenantId: string, userId: string, claimId: string, rejectionId: string, reason: string) {
  const invoiceId = await prisma.$transaction(async (tx) => {
    const claim = await lockClaim(tx, tenantId, claimId);
    assertOpen(claim.status);
    const rejection = await tx.insuranceClaimRejection.findFirst({ where: { id: rejectionId, tenantId, claimItem: { claimId: claim.id } } });
    if (!rejection) throw new CoverageError("rejection_not_found", 404);
    if (rejection.reversedAt) throw new CoverageError("rejection_reversed");
    const item = claim.items.find((i) => i.id === rejection.claimItemId)!;
    await tx.insuranceClaimRejection.update({ where: { id: rejection.id }, data: { reversedAt: new Date(), reversedById: userId, reversalReason: reason } });
    await tx.insuranceClaimItem.update({ where: { id: item.id }, data: { rejectedAmount: { decrement: rejection.amount } } });
    if (rejection.chargedToPatient) await tx.patientInvoice.update({ where: { id: item.invoiceId }, data: { insurerRejectedToPatient: { decrement: rejection.amount } } });
    await refreshClaimStatus(tx, claim.id);
    return item.invoiceId;
  });
  await recalculateInvoiceTotals(invoiceId);
}

// Spreads `amount` of a payment over claim items of its payer: explicit allocations, or the
// oldest outstanding items first (within `claimId` when given). Returns what was allocated.
async function allocate(tx: Tx, tenantId: string, payment: { id: string; payerId: string }, amount: number, claimId: string | null, explicit: { itemId: string; amount: number }[] | null) {
  const claims = await tx.insuranceClaim.findMany({
    where: { tenantId, payerId: payment.payerId, status: { in: [...OPEN_STATUSES] }, ...(claimId ? { id: claimId } : {}) },
    select: { id: true },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });
  if (claimId && claims.length === 0) throw new CoverageError("claim_not_submitted");
  for (const c of claims) await lockClaim(tx, tenantId, c.id);
  const items = await tx.insuranceClaimItem.findMany({ where: { claimId: { in: claims.map((c) => c.id) } }, orderBy: [{ claim: { submittedAt: "asc" } }, { createdAt: "asc" }] });
  const byId = new Map(items.map((i) => [i.id, i]));
  const allocations = explicit ?? allocateOldestFirst(amount, items.map((i) => ({ id: i.id, outstanding: outstandingOf(i) })));
  if (allocations.reduce((s, a) => s + a.amount, 0) > amount) throw new CoverageError("allocations_exceed_payment");
  for (const a of allocations) {
    const item = byId.get(a.itemId);
    if (!item) throw new CoverageError("invalid_allocations");
    if (a.amount > outstandingOf(item)) throw new CoverageError("amount_exceeds_outstanding");
  }
  for (const a of allocations) {
    const item = byId.get(a.itemId)!;
    await tx.payerPaymentAllocation.create({ data: { tenantId, paymentId: payment.id, claimItemId: item.id, amount: a.amount } });
    await tx.insuranceClaimItem.update({ where: { id: item.id }, data: { paidAmount: { increment: a.amount } } });
    await tx.patientInvoice.update({ where: { id: item.invoiceId }, data: { insurerPaidAmount: { increment: a.amount } } });
    item.paidAmount = new Prisma.Decimal(n(item.paidAmount) + a.amount);
  }
  for (const id of new Set(allocations.map((a) => byId.get(a.itemId)!.claimId))) await refreshClaimStatus(tx, id);
  return allocations.reduce((s, a) => s + a.amount, 0);
}

// Money received from a payer. What is not allocated stays on the payment as an unallocated
// balance, allocated later or refunded to the payer.
export async function recordPayerPayment(tenantId: string, userId: string, input: PayerPaymentInput) {
  return prisma.$transaction(
    async (tx) => {
      const payer = await tx.payer.findFirst({ where: { id: input.payerId, tenantId }, select: { id: true } });
      if (!payer) throw new CoverageError("invalid_payer");
      const payment = await tx.payerPayment.create({
        data: { tenantId, payerId: payer.id, claimId: input.claimId, amount: input.amount, receivedAt: input.receivedAt, method: input.method, reference: input.reference, notes: input.notes, recordedById: userId },
      });
      const allocated = await allocate(tx, tenantId, payment, input.amount, input.claimId, input.allocations);
      return { payment, allocated };
    },
    { timeout: 30_000 }
  );
}

// Allocates (part of) the unallocated balance of an earlier payment.
export async function allocatePayerPayment(tenantId: string, paymentId: string, claimId: string | null, explicit: { itemId: string; amount: number }[] | null) {
  return prisma.$transaction(async (tx) => {
    const { payment, unallocated } = await lockPayment(tx, tenantId, paymentId);
    if (payment.status === "cancelled") throw new CoverageError("payment_cancelled");
    if (unallocated <= 0) throw new CoverageError("nothing_unallocated");
    return allocate(tx, tenantId, payment, unallocated, claimId, explicit);
  }, { timeout: 30_000 });
}

// Undoes an allocation (wrong invoice): the amount goes back to the payment's unallocated
// balance and is due by the payer again on the item.
export async function reverseAllocation(tenantId: string, userId: string, allocationId: string) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.payerPaymentAllocation.findFirst({ where: { id: allocationId, tenantId }, include: { claimItem: { select: { id: true, claimId: true, invoiceId: true } } } });
    if (!allocation) throw new CoverageError("allocation_not_found", 404);
    await lockPayment(tx, tenantId, allocation.paymentId);
    const claim = await lockClaim(tx, tenantId, allocation.claimItem.claimId);
    assertOpen(claim.status);
    const current = await tx.payerPaymentAllocation.findUniqueOrThrow({ where: { id: allocationId } });
    if (current.reversedAt) throw new CoverageError("allocation_reversed");
    await tx.payerPaymentAllocation.update({ where: { id: allocationId }, data: { reversedAt: new Date(), reversedById: userId } });
    await tx.insuranceClaimItem.update({ where: { id: allocation.claimItem.id }, data: { paidAmount: { decrement: allocation.amount } } });
    await tx.patientInvoice.update({ where: { id: allocation.claimItem.invoiceId }, data: { insurerPaidAmount: { decrement: allocation.amount } } });
    await refreshClaimStatus(tx, claim.id);
    return allocation;
  });
}

// Gives part of the unallocated balance back to the payer (overpayment, duplicate transfer).
export async function refundPayerPayment(tenantId: string, userId: string, paymentId: string, input: PayerRefundInput) {
  return prisma.$transaction(async (tx) => {
    const { payment, unallocated } = await lockPayment(tx, tenantId, paymentId);
    if (payment.status === "cancelled") throw new CoverageError("payment_cancelled");
    if (input.amount > unallocated) throw new CoverageError("amount_exceeds_unallocated");
    return tx.payerPaymentRefund.create({ data: { tenantId, paymentId, amount: input.amount, refundedAt: input.refundedAt, reference: input.reference, reason: input.reason, recordedById: userId } });
  });
}

// A payment recorded by mistake: cancelled once nothing is allocated nor refunded on it.
export async function cancelPayerPayment(tenantId: string, paymentId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const { payment, allocated, refunded } = await lockPayment(tx, tenantId, paymentId);
    if (payment.status === "cancelled") throw new CoverageError("payment_cancelled");
    if (allocated > 0 || refunded > 0) throw new CoverageError("payment_in_use");
    return tx.payerPayment.update({ where: { id: paymentId }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason } });
  });
}

// Outstanding receivable per payer: claimed and not yet settled, the payer shares of invoices not
// yet claimed, and the unallocated balance of its payments (money received, not yet matched).
export async function receivablesByPayer(tenantId: string) {
  const payers = await prisma.payer.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, isActive: true }, orderBy: { name: "asc" } });
  const items = await prisma.insuranceClaimItem.findMany({ where: { tenantId, claim: { status: { not: "draft" } } }, select: { claimedAmount: true, paidAmount: true, rejectedAmount: true, claim: { select: { payerId: true } } } });
  const unclaimed = await prisma.patientInvoice.findMany({
    where: { tenantId, status: { not: "cancelled" }, insuranceAmount: { gt: 0 }, coverageId: { not: null }, claimItems: { none: {} } },
    select: { insuranceAmount: true, coverage: { select: { policy: { select: { agreement: { select: { payerId: true } } } } } } },
  });
  const payments = await prisma.payerPayment.findMany({
    where: { tenantId, status: "recorded" },
    select: { payerId: true, amount: true, allocations: { where: { reversedAt: null }, select: { amount: true } }, refunds: { select: { amount: true } } },
  });
  return payers.map((p) => {
    const own = items.filter((i) => i.claim.payerId === p.id);
    return {
      ...p,
      claimed: own.reduce((s, i) => s + n(i.claimedAmount), 0),
      paid: own.reduce((s, i) => s + n(i.paidAmount), 0),
      rejected: own.reduce((s, i) => s + n(i.rejectedAmount), 0),
      outstanding: own.reduce((s, i) => s + outstandingOf(i), 0),
      notYetClaimed: unclaimed.filter((u) => u.coverage?.policy.agreement.payerId === p.id).reduce((s, u) => s + n(u.insuranceAmount), 0),
      unallocated: payments
        .filter((x) => x.payerId === p.id)
        .reduce((s, x) => s + n(x.amount) - x.allocations.reduce((a, y) => a + n(y.amount), 0) - x.refunds.reduce((a, y) => a + n(y.amount), 0), 0),
    };
  });
}
