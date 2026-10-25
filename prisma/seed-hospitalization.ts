import { BillingInvoiceStatus, BillingSourceType, PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { getRoomTypeDailyPrice } from '../lib/billing/roomPricing';
import { hospitalizedDays } from '../lib/billing/hospitalizedDays';
import { recalculateInvoiceTotals } from '../lib/billing/suggestCharge';

// Demo data only (seed-patient-journeys.ts, backfill-demo-hospitalizations.ts).
//
// A hospitalisation the way the app records it (POST /stays/:id/hospitalization, then the
// cashier's payment and the discharge): admitted status, hospitalisation bed and department,
// and the deposit (room's daily price × planned days) on the stay's invoice — regularised to
// the real length (lib/billing/hospitalizedDays) when the stay has ended. Without this, demo
// stays never appear on the discharges page.

// Daily price used when the bed's room has none configured in the tariff grid.
const DEFAULT_DAILY_PRICE = 10000;

export async function hospitalizeDemoStay(params: {
  tenantId: string;
  issuedById: string;
  stayId: string;
  patientId: string;
  bedId: string;
  departmentId: string;
  hospitalizedAt: Date;
  plannedDays: number;
  // Set for a stay that has ended: the bed is released and the deposit regularised.
  leftAt?: Date;
  depositPaid: boolean;
}) {
  const { tenantId, issuedById, stayId, patientId, bedId, departmentId, hospitalizedAt, plannedDays, leftAt, depositPaid } = params;
  const bed = await prisma.bed.findUniqueOrThrow({ where: { id: bedId }, select: { roomTypeId: true } });
  const room = bed.roomTypeId
    ? await prisma.referenceCatalogItem.findUnique({ where: { id: bed.roomTypeId }, select: { code: true, nameFr: true } })
    : null;
  const dailyPrice = (room ? await getRoomTypeDailyPrice(prisma, tenantId, room.code) : null) ?? DEFAULT_DAILY_PRICE;

  await prisma.stay.update({
    where: { id: stayId },
    data: {
      bedId: leftAt ? null : bedId,
      hospitalizationStatus: 'admitted',
      hospitalizationRequestedAt: hospitalizedAt,
      hospitalizedAt,
      hospitalizationBedId: bedId,
      hospitalizationDepartmentId: departmentId,
    },
  });
  if (leftAt) {
    await prisma.bed.updateMany({ where: { id: bedId, currentStayId: stayId }, data: { status: 'available', currentStayId: null } });
  }

  const days = leftAt ? hospitalizedDays(hospitalizedAt, leftAt) : plannedDays;
  const roomSuffix = room ? ` — ${room.nameFr}` : '';
  const invoice =
    (await prisma.patientInvoice.findFirst({ where: { stayId, status: { not: BillingInvoiceStatus.cancelled } }, orderBy: { createdAt: 'asc' } })) ??
    (await prisma.patientInvoice.create({ data: { tenantId, patientId, stayId, status: BillingInvoiceStatus.draft, issuedById, currency: 'XAF' } }));

  // Idempotent: a stay is hospitalised once (the backfill may be re-run).
  const existingLine = await prisma.patientInvoiceLine.findFirst({ where: { sourceType: BillingSourceType.hospitalization, sourceId: stayId } });
  if (!existingLine) {
    await prisma.patientInvoiceLine.create({
      data: {
        tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.hospitalization, sourceId: stayId,
        description: leftAt
          ? `Hospitalisation${roomSuffix} (${days} j ; caution de ${plannedDays} j régularisée)`
          : `Hospitalisation${roomSuffix} (caution de ${plannedDays} j)`,
        quantity: days, unitPrice: dailyPrice, amount: dailyPrice * days,
      },
    });
    if (depositPaid) {
      const deposit = dailyPrice * plannedDays;
      await prisma.payment.create({
        data: { tenantId, invoiceId: invoice.id, amount: deposit, method: PaymentMethod.cash, status: PaymentStatus.successful, currency: 'XAF', initiatedById: issuedById, initiatedAt: hospitalizedAt, completedAt: hospitalizedAt },
      });
      await prisma.patientInvoice.update({ where: { id: invoice.id }, data: { paidAmount: { increment: deposit } } });
    }
  }
  await recalculateInvoiceTotals(invoice.id);
}
