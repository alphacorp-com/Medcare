import prisma from "@/lib/prisma";

// Marks a Payment successful and rolls its amount into the parent invoice's paidAmount,
// flipping the invoice to "paid" once paidAmount covers the patient's share.
export async function applySuccessfulPayment(invoiceId: string, amount: number) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const paidAmount = Number(invoice.paidAmount) + amount;
  const subtotal = Number(invoice.subtotal);

  await prisma.patientInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status: paidAmount >= subtotal && subtotal > 0 ? "paid" : "partially_paid",
    },
  });
}
