import { Prisma, BillingSourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isModuleActiveForTenant } from "@/lib/tenant-licensing";

export type SuggestChargeParams = {
  tenantId: string;
  patientId: string;
  stayId?: string | null;
  sourceType: BillingSourceType;
  sourceId: string;
  description: string;
  quantity?: number;
  feeCode: string;
  performedById: string;
};

export type ChargeLineInput = {
  sourceType: BillingSourceType;
  sourceId: string;
  description: string;
  quantity?: number;
  feeCode: string;
};

export type SuggestChargeResult = {
  invoiceId: string;
  invoiceLineId: string;
  amount: number;
  currency: string;
};

// Finds the invoice that new charges for this patient/stay should accumulate onto
// (any not-yet-fully-settled invoice for the same stay), or opens a new one. Ambulatory
// acts (no stayId) always start a fresh invoice — there is no natural "running tab" to
// attach them to across unrelated visits.
export async function findOrCreateOpenInvoice(
  tenantId: string,
  patientId: string,
  stayId: string | null | undefined,
  issuedById: string
) {
  const existing = stayId
    ? await prisma.patientInvoice.findFirst({
        where: { tenantId, stayId, status: { in: ["draft", "pending_payment", "partially_paid"] } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (existing) return existing;

  return prisma.patientInvoice.create({
    data: {
      tenantId,
      patientId,
      stayId: stayId ?? null,
      status: "draft",
      issuedById,
      currency: "XAF",
    },
  });
}

// Recomputes subtotal/patientAmount from the current line items and re-derives status
// from paidAmount vs. the new patientAmount — not just carried over from the previous
// status — so that e.g. adding a line (or raising a price) to an already-"paid" invoice
// correctly drops it back to "partially_paid" once there's an outstanding balance again.
export async function recalculateInvoiceTotals(invoiceId: string) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const totals = await prisma.patientInvoiceLine.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const subtotal = Number(totals._sum.amount ?? 0);
  const patientAmount = subtotal - Number(invoice.insuranceAmount);
  const paidAmount = Number(invoice.paidAmount);

  const status =
    invoice.status === "cancelled"
      ? "cancelled"
      : paidAmount <= 0
      ? "pending_payment"
      : paidAmount >= patientAmount && patientAmount > 0
      ? "paid"
      : "partially_paid";

  return prisma.patientInvoice.update({
    where: { id: invoiceId },
    data: { subtotal, patientAmount, status },
  });
}

// Creates one InvoiceLine, tolerating a duplicate (already-billed) source act by
// returning the existing line instead of throwing.
async function createLineIdempotent(tenantId: string, invoiceId: string, line: ChargeLineInput, unitPrice: number) {
  const quantity = line.quantity ?? 1;
  const amount = unitPrice * quantity;

  try {
    return await prisma.patientInvoiceLine.create({
      data: {
        tenantId,
        invoiceId,
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        description: line.description,
        quantity,
        unitPrice,
        amount,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.patientInvoiceLine.findFirst({
        where: { sourceType: line.sourceType, sourceId: line.sourceId },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

async function lookupUnitPrice(tenantId: string, sourceType: BillingSourceType, feeCode: string): Promise<number> {
  const feeSchedule = await prisma.feeSchedule.findFirst({
    where: { tenantId, sourceType, code: feeCode, isActive: true },
  });
  return feeSchedule ? Number(feeSchedule.unitPrice) : 0;
}

// Auto-creates a PatientInvoiceLine (and its parent PatientInvoice if needed) for a
// clinical act that just completed, when MODULE_BILLING is active for the tenant.
// Never throws — billing is a side effect of the clinical workflow, not a precondition
// for it, so any failure here is logged and swallowed.
export async function suggestInvoiceLine(params: SuggestChargeParams): Promise<SuggestChargeResult | null> {
  const { tenantId, patientId, stayId, performedById } = params;

  try {
    const billingActive = await isModuleActiveForTenant(tenantId, "MODULE_BILLING");
    if (!billingActive) return null;

    const unitPrice = await lookupUnitPrice(tenantId, params.sourceType, params.feeCode);
    const invoice = await findOrCreateOpenInvoice(tenantId, patientId, stayId, performedById);
    const line = await createLineIdempotent(tenantId, invoice.id, params, unitPrice);
    await recalculateInvoiceTotals(invoice.id);

    return { invoiceId: invoice.id, invoiceLineId: line.id, amount: Number(line.amount), currency: invoice.currency };
  } catch (error) {
    console.error("[suggestInvoiceLine] Failed to auto-generate billing line:", error);
    return null;
  }
}

// Same as suggestInvoiceLine but for an act that produces several line items at once
// (e.g. a prescription with multiple drugs) — all lines land on the same invoice and
// totals are recalculated once at the end.
export async function suggestInvoiceLines(
  tenantId: string,
  patientId: string,
  stayId: string | null | undefined,
  performedById: string,
  lines: ChargeLineInput[],
  unitPriceForLine: (line: ChargeLineInput) => Promise<number> | number
): Promise<SuggestChargeResult[]> {
  if (lines.length === 0) return [];

  try {
    const billingActive = await isModuleActiveForTenant(tenantId, "MODULE_BILLING");
    if (!billingActive) return [];

    const invoice = await findOrCreateOpenInvoice(tenantId, patientId, stayId, performedById);

    const results: SuggestChargeResult[] = [];
    for (const line of lines) {
      const unitPrice = await unitPriceForLine(line);
      const created = await createLineIdempotent(tenantId, invoice.id, line, unitPrice);
      results.push({
        invoiceId: invoice.id,
        invoiceLineId: created.id,
        amount: Number(created.amount),
        currency: invoice.currency,
      });
    }

    await recalculateInvoiceTotals(invoice.id);
    return results;
  } catch (error) {
    console.error("[suggestInvoiceLines] Failed to auto-generate billing lines:", error);
    return [];
  }
}
