import prisma from "@/lib/prisma";
import type { BillingSourceType, Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InvoiceAmounts = {
  status: string;
  patientAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
};

type LineRef = { sourceType: BillingSourceType; sourceId: string | null };

// The patient's share (ticket modérateur, i.e. patientAmount after insurance) is what
// gates care — the insurer's share is recovered separately and never blocks the patient.
export function isInvoiceSettled(invoice: InvoiceAmounts): boolean {
  return invoice.status !== "cancelled" && Number(invoice.paidAmount) >= Number(invoice.patientAmount);
}

// Moves everything an invoice was holding back out of "awaiting_payment": the admission
// a "consultation" line was billed for re-enters the doctor's queue, and each billed
// exam becomes actionable in the lab/radiology module. Used both once an invoice is
// settled and for an explicit payment waiver.
export async function releaseInvoiceLines(tenantId: string | null, lines: LineRef[]) {
  const idsFor = (sourceType: BillingSourceType) =>
    lines
      .filter((line) => line.sourceType === sourceType && line.sourceId && UUID_RE.test(line.sourceId))
      .map((line) => line.sourceId as string);

  const stayIds = idsFor("consultation");
  const examIds = idsFor("exam");

  const [stays, exams] = await Promise.all([
    stayIds.length
      ? prisma.stay.updateMany({
          where: { id: { in: stayIds }, tenantId, consultationStatus: "awaiting_payment" },
          data: { consultationStatus: "waiting" },
        })
      : { count: 0 },
    examIds.length
      ? prisma.examRequest.updateMany({
          where: { id: { in: examIds }, tenantId, status: "awaiting_payment" },
          data: { status: "requested" },
        })
      : { count: 0 },
  ]);

  return { stays: stays.count, exams: exams.count };
}

// Called after anything that can change an invoice's balance (a payment, a line added
// or edited, an insurance amount). Never throws — a failed release is recoverable through
// the billing waiver, whereas a thrown error here would fail the payment itself.
export async function releaseIfSettled(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.patientInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { sourceType: true, sourceId: true } } },
    });
    if (!invoice || !isInvoiceSettled(invoice)) return;
    await releaseInvoiceLines(invoice.tenantId, invoice.lines);
  } catch (error) {
    console.error("[releaseIfSettled] Failed to release paid items:", error);
  }
}
