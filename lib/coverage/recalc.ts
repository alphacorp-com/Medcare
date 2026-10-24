import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";

// After a change of coverage terms (convention, programme, patient coverage, enrolment,
// authorization), the invoices still open — not settled, not claimed to a payer — are
// recomputed so the cashier collects the right patient share. Settled or claimed invoices
// never move. Bounded: the most recent 300 per change.
export async function recalcOpenInvoices(where: Prisma.PatientInvoiceWhereInput): Promise<number> {
  const invoices = await prisma.patientInvoice.findMany({
    where: { ...where, status: { in: ["draft", "pending_payment", "partially_paid"] }, claimItems: { none: {} } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  for (const invoice of invoices) await recalculateInvoiceTotals(invoice.id);
  return invoices.length;
}
