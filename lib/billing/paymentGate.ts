import prisma from "@/lib/prisma";
import { isModuleActiveForTenant } from "@/lib/tenant-licensing";
import { lookupUnitPrice, recalculateInvoiceTotals, suggestInvoiceLine, suggestInvoiceLines } from "@/lib/billing/suggestCharge";
import { admitHospitalization } from "@/lib/billing/release";
import { hospitalizedDays } from "@/lib/billing/hospitalizedDays";
import type { BillingSourceType, ExamRequest, ExamUrgency, Prisma, StayType, TriageAcuity } from "@prisma/client";

// "Pay first, then care": an admission's medical act is billed at admission and the patient
// only reaches the doctor's queue once it's paid; a lab/radiology exam is billed when the
// doctor prescribes it and the lab/radiology module can only act on it once it's paid.
// Released by lib/billing/release.ts when the invoice is settled, or by an audited waiver
// (POST /api/v1/billing/[id]/waive).
//
// Exception — vital emergencies (triaged resuscitation/emergent): care is never held back
// waiting for a payment. The admission still gets billed, to be settled afterwards.

const VITAL_EMERGENCY_ACUITIES: TriageAcuity[] = ["resuscitation", "emergent"];

type StayTriage = { type: StayType; triageAcuity: TriageAcuity | null };

export function isVitalEmergency(stay: StayTriage): boolean {
  return stay.type === "emergency" && stay.triageAcuity !== null && VITAL_EMERGENCY_ACUITIES.includes(stay.triageAcuity);
}

export async function isPaymentGateActive(tenantId: string | null): Promise<boolean> {
  return tenantId ? isModuleActiveForTenant(tenantId, "MODULE_BILLING") : false;
}

// For a vital emergency, only STAT exams skip the gate — routine follow-up exams ordered
// once the patient is stabilised go through the cashier like any other.
export function examNeedsPrepayment(gateActive: boolean, stay: StayTriage | null, urgency: ExamUrgency): boolean {
  if (!gateActive) return false;
  return !(urgency === "stat" && stay && isVitalEmergency(stay));
}

// Bills an admission's medical act onto the stay's invoice. If billing fails while the stay
// is held in "awaiting_payment", the stay is let through rather than left stuck with no
// invoice for the cashier to collect against.
export async function chargeAdmissionAct(params: {
  tenantId: string | null;
  patientId: string;
  stayId: string;
  act: { code: string; nameFr: string; basePrice: Prisma.Decimal | number };
  performedById: string;
}) {
  const { tenantId, patientId, stayId, act, performedById } = params;
  const billing = !tenantId ? null : await suggestInvoiceLine({
    tenantId,
    patientId,
    stayId,
    sourceType: "consultation",
    sourceId: stayId,
    description: act.nameFr,
    feeCode: act.code,
    unitPrice: Number(act.basePrice),
    performedById,
  });

  if (!billing) {
    await prisma.stay.updateMany({
      where: { id: stayId, consultationStatus: "awaiting_payment" },
      data: { consultationStatus: "waiting" },
    });
  }
  return billing;
}

// Bills freshly prescribed exams together on one invoice. Same fail-open rule as above for
// any exam created in "awaiting_payment".
export async function chargePrescribedExams(params: {
  tenantId: string | null;
  patientId: string;
  stayId: string | null;
  performedById: string;
  exams: Pick<ExamRequest, "id" | "examCode" | "examLabel" | "status">[];
}) {
  const { tenantId, patientId, stayId, performedById, exams } = params;
  const billing = !tenantId ? [] : await suggestInvoiceLines(
    tenantId,
    patientId,
    stayId,
    performedById,
    exams.map((exam) => ({ sourceType: "exam", sourceId: exam.id, description: exam.examLabel, feeCode: exam.examCode })),
    (line) => lookupUnitPrice(tenantId, "exam", line.feeCode)
  );

  const gatedIds = exams.filter((exam) => exam.status === "awaiting_payment").map((exam) => exam.id);
  if (billing.length === 0 && gatedIds.length > 0) {
    await prisma.examRequest.updateMany({
      where: { id: { in: gatedIds }, status: "awaiting_payment" },
      data: { status: "requested" },
    });
  }
  return billing;
}

// Bills the hospitalisation deposit (caution) — the room's daily price × planned days — onto
// the stay's invoice; the reserved bed is taken once it's paid. The line keeps the daily
// price and the planned days (unitPrice × quantity): at discharge it is regularised to the
// days actually spent (see regularizeHospitalizationCharge). If billing fails, the patient is
// admitted anyway rather than left in the corridor with no invoice to pay.
export async function chargeHospitalization(params: {
  tenantId: string | null;
  patientId: string;
  stayId: string;
  room: { code: string; label: string };
  dailyPrice: number;
  days: number;
  performedById: string;
}) {
  const { tenantId, patientId, stayId, room, dailyPrice, days, performedById } = params;
  const billing = !tenantId ? null : await suggestInvoiceLine({
    tenantId,
    patientId,
    stayId,
    sourceType: "hospitalization",
    sourceId: stayId,
    description: `Caution hospitalisation — ${room.label} (${days} j prévus)`,
    feeCode: room.code,
    quantity: days,
    unitPrice: dailyPrice,
    performedById,
  });

  if (!billing) await admitHospitalization(stayId);
  return billing;
}

// Turns the hospitalisation deposit line into the final charge once the patient leaves the
// bed: same daily price, but the days actually spent. The invoice is recalculated, so the
// cashier sees either the balance still owed (longer stay than planned) or the overpayment
// to refund (shorter stay) — the invoice page already shows "refund due" when paid > owed.
// Returns null when there was nothing to regularise (billing off, or never billed).
// Must run once per stay (when it leaves its bed): it reads the planned days from the line.
export async function regularizeHospitalizationCharge(params: {
  stayId: string;
  roomLabel: string | null;
  hospitalizedAt: Date;
  leftAt: Date;
}): Promise<{ invoiceId: string; plannedDays: number; actualDays: number; amount: number } | null> {
  const { stayId, roomLabel, hospitalizedAt, leftAt } = params;
  const line = await prisma.patientInvoiceLine.findFirst({
    where: { sourceType: "hospitalization", sourceId: stayId },
    include: { invoice: { select: { status: true } } },
  });
  if (!line || line.invoice.status === "cancelled") return null;

  const plannedDays = Number(line.quantity);
  const actualDays = hospitalizedDays(hospitalizedAt, leftAt);
  const unitPrice = Number(line.unitPrice);

  await prisma.patientInvoiceLine.update({
    where: { id: line.id },
    data: {
      description: `Hospitalisation${roomLabel ? ` — ${roomLabel}` : ""} (${actualDays} j ; caution de ${plannedDays} j régularisée)`,
      quantity: actualDays,
      amount: unitPrice * actualDays,
    },
  });
  await recalculateInvoiceTotals(line.invoiceId);

  return { invoiceId: line.invoiceId, plannedDays, actualDays, amount: unitPrice * actualDays };
}

// A charge whose act was cancelled before anything was paid on its invoice shouldn't stay
// on the patient's bill. Once a payment exists the line is left alone — refunding is the
// cashier's call. Never throws: the cancellation itself has already succeeded.
export async function removeUnpaidCharge(sourceType: BillingSourceType, sourceId: string): Promise<void> {
  try {
    const line = await prisma.patientInvoiceLine.findFirst({
      where: { sourceType, sourceId },
      include: { invoice: { select: { id: true, status: true, paidAmount: true } } },
    });
    if (!line || line.invoice.status === "cancelled" || Number(line.invoice.paidAmount) > 0) return;

    await prisma.patientInvoiceLine.delete({ where: { id: line.id } });
    const remaining = await prisma.patientInvoiceLine.count({ where: { invoiceId: line.invoice.id } });
    if (remaining === 0) {
      await prisma.patientInvoice.update({
        where: { id: line.invoice.id },
        data: { status: "cancelled", subtotal: 0, patientAmount: 0 },
      });
    } else {
      await recalculateInvoiceTotals(line.invoice.id);
    }
  } catch (error) {
    console.error("[removeUnpaidCharge] Failed to remove charge:", error);
  }
}
