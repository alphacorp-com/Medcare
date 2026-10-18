import prisma from "@/lib/prisma";
import { releaseIfSettled } from "@/lib/billing/release";

// Marks a Payment successful and rolls its amount into the parent invoice's paidAmount,
// flipping the invoice to "paid" once paidAmount covers the patient's share (patientAmount,
// i.e. after insurance — same rule as recalculateInvoiceTotals), then releases whatever the
// invoice was holding back (admission waiting for the doctor, exams waiting for the lab).
export async function applySuccessfulPayment(invoiceId: string, amount: number) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const paidAmount = Number(invoice.paidAmount) + amount;
  const patientAmount = Number(invoice.patientAmount);

  await prisma.patientInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status: paidAmount >= patientAmount && patientAmount > 0 ? "paid" : "partially_paid",
    },
  });

  await releaseIfSettled(invoiceId);
}
