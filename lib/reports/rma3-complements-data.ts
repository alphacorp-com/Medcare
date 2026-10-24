import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ActivityTable } from "@/lib/reports/activity-rows";
import { buildComplementTables } from "@/lib/reports/rma3-complements";
import { allocateIncome, defaultRubric, UNCLASSIFIED, type IncomeLine, type IncomePayment } from "@/lib/reports/rma3-income";
import { codeMatchesItems, parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";
import { parseStoredLines, resolveLineArticle } from "@/lib/stock/prescription-items";

// Loads the last RMA3 complements (rma3-complements.ts) and the billing income of the month
// (rma3-income.ts). Every query is scoped to the facility.

const person = { select: { birthDate: true, gender: true } } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STI = parseIcd10Ranges("A50-A64");

export async function computeComplementTables(tenantId: string, start: Date, end: Date): Promise<ActivityTable[]> {
  const month = { gte: start, lt: end };
  const [tbScreenings, tbCases, consultations, ironArticles, chronicEnrolments, declarations, reactions] = await Promise.all([
    prisma.tbScreening.findMany({
      where: { tenantId, OR: [{ screenedAt: month }, { sentToLabAt: month }, { testedAt: month }, { tptStartedAt: month }] },
      select: { id: true, patientId: true, screenedAt: true, presumptive: true, sentToLabAt: true, testedAt: true, tptStartedAt: true, patient: person },
    }),
    prisma.tbCase.findMany({
      where: { tenantId, OR: [{ notificationDate: month }, { secondLineStartedAt: month }] },
      select: { id: true, notificationDate: true, classification: true, rifampicinResistant: true, cotrimoxazole: true, isHealthWorker: true, secondLineStartedAt: true, patient: person },
    }),
    prisma.stay.findMany({
      where: { tenantId, admissionDate: month, consultationStatus: "completed" },
      select: { patientId: true, admissionDate: true, followedNationalProtocol: true, patient: person, diagnoses: { select: { icd10Code: true } } },
    }),
    prisma.medicationInventory.findMany({ where: { tenantId, rma3Treatment: "iron_folate" }, select: { id: true, name: true } }),
    prisma.chronicCareEnrolment.findMany({
      where: { tenantId, enrolledAt: { lt: end }, OR: [{ exitedAt: null }, { exitedAt: { gte: start } }] },
      select: {
        id: true,
        condition: true,
        enrolledAt: true,
        exitedAt: true,
        patient: person,
        visits: { where: { visitDate: month }, select: { visitDate: true, onTreatment: true, systolic: true, diastolic: true, hba1c: true, educationIndividual: true, educationGroup: true } },
      },
    }),
    prisma.civilRegistrationDeclaration.findMany({ where: { tenantId, transmittedAt: month }, select: { type: true, transmittedAt: true } }),
    prisma.drugAdverseReaction.findMany({
      where: { tenantId, OR: [{ createdAt: month }, { investigatedAt: month }] },
      select: { id: true, createdAt: true, serious: true, investigatedAt: true, drugName: true, lotNumber: true, expiryDate: true },
    }),
  ]);

  // Iron / folic acid prescribed this month (articles tagged in the pharmacy).
  let ironPrescriptions: { patientId: string; at: Date; patient: { birthDate: Date; gender: string } }[] = [];
  if (ironArticles.length) {
    const byId = new Map(ironArticles.map((a) => [a.id, a]));
    const byName = new Map(ironArticles.map((a) => [a.name.toLowerCase(), a]));
    const prescriptions = await prisma.prescription.findMany({
      where: { tenantId, prescribedAt: month },
      select: { patientId: true, prescribedAt: true, items: true, patient: person },
    });
    ironPrescriptions = prescriptions
      .filter((p) => parseStoredLines(p.items).some((line) => resolveLineArticle(line, byId, byName)))
      .map((p) => ({ patientId: p.patientId, at: p.prescribedAt, patient: p.patient }));
  }

  return buildComplementTables({
    start,
    end,
    tbScreenings,
    tbCases,
    consultations: consultations.map((s) => ({
      patientId: s.patientId,
      at: s.admissionDate,
      followedNationalProtocol: s.followedNationalProtocol,
      stiDiagnosis: s.diagnoses.some((d) => STI.ok && codeMatchesItems(d.icd10Code, STI.items)),
      patient: s.patient,
    })),
    ironPrescriptions,
    chronicEnrolments: chronicEnrolments.map((e) => ({ ...e, visits: e.visits.map((v) => ({ ...v, hba1c: v.hba1c === null ? null : Number(v.hba1c) })) })),
    declarations,
    reactions: reactions.map(({ createdAt, ...r }) => ({ ...r, reportedAt: createdAt })),
  });
}

const INVOICE_FOR_INCOME = {
  select: { stay: { select: { medicalActCode: true } }, lines: { select: { sourceType: true, sourceId: true, amount: true, quantity: true, payerAmount: true, exemptionAmount: true } } },
} as const;

// Income of the month per RMA3 rubric (FCFA), from the money received net of what was given back:
//  - the patients' payments, spread over the invoice lines in proportion to the patient's share
//    of each line; a moved overpayment (credit_transfer) is not new money and is left out;
//  - the payers' settlements received in the month, in full: their allocated part spread over
//    the lines in proportion to the payer's share, the part not yet allocated unclassified;
//  - minus the refunds of the month (to patients over their invoice's lines, to payers unclassified).
// Free care (exemptions) brings no money and is not income.
export async function computeBillingIncome(tenantId: string, start: Date, end: Date): Promise<Record<string, number>> {
  const month = { gte: start, lt: end };
  const [patientPayments, payerPayments, patientRefunds, payerRefunds] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, status: "successful", method: { not: "credit_transfer" }, OR: [{ completedAt: month }, { completedAt: null, initiatedAt: month }] },
      select: { amount: true, invoice: INVOICE_FOR_INCOME },
    }),
    prisma.payerPayment.findMany({
      where: { tenantId, status: "recorded", receivedAt: month },
      select: { amount: true, allocations: { where: { reversedAt: null }, select: { amount: true, claimItem: { select: { invoice: INVOICE_FOR_INCOME } } } } },
    }),
    prisma.patientRefund.findMany({ where: { tenantId, kind: "refund", refundedAt: month }, select: { amount: true, invoice: INVOICE_FOR_INCOME } }),
    prisma.payerPaymentRefund.findMany({ where: { tenantId, refundedAt: month }, select: { amount: true } }),
  ]);
  type IncomeInvoice = (typeof patientPayments)[number]["invoice"];
  const payments: { amount: Prisma.Decimal; invoice: IncomeInvoice; payerShare: boolean }[] = [
    ...patientPayments.map((p) => ({ ...p, payerShare: false })),
    ...payerPayments.flatMap((p) => p.allocations.map((a) => ({ amount: a.amount, invoice: a.claimItem.invoice, payerShare: true }))),
  ];
  const unallocated = payerPayments.reduce((s, p) => s + Number(p.amount) - p.allocations.reduce((a, x) => a + Number(x.amount), 0), 0);
  const refundedToPayers = payerRefunds.reduce((s, r) => s + Number(r.amount), 0);
  const refunds: typeof payments = patientRefunds.map((r) => ({ amount: r.amount, invoice: r.invoice, payerShare: false }));
  if (payments.length === 0 && refunds.length === 0 && unallocated === 0 && refundedToPayers === 0) return {};
  const lines = [...payments, ...refunds].flatMap((p) => p.invoice.lines);
  const idsOf = (type: string) => [...new Set(lines.filter((l) => l.sourceType === type && l.sourceId && UUID.test(l.sourceId)).map((l) => l.sourceId!))];
  const inventoryIds = [...new Set(lines.filter((l) => l.sourceType === "pharmacy_dispensation" && l.sourceId?.includes(":")).map((l) => l.sourceId!.split(":")[1]).filter((id) => UUID.test(id)))];

  const [exams, surgeries, categories, receipts] = await Promise.all([
    prisma.examRequest.findMany({ where: { tenantId, id: { in: idsOf("exam") } }, select: { id: true, type: true, examCode: true } }),
    prisma.surgicalProcedure.findMany({ where: { tenantId, id: { in: idsOf("surgery") } }, select: { id: true, procedureCode: true } }),
    prisma.medicalAct.findMany({ where: { tenantId, category: { rma3IncomeRubric: { not: null } } }, select: { code: true, category: { select: { rma3IncomeRubric: true } } } }),
    inventoryIds.length
      ? prisma.stockMovement.findMany({ where: { tenantId, itemId: { in: inventoryIds }, type: "receipt", unitCost: { not: null }, occurredAt: { lt: end } }, select: { itemId: true, quantity: true, unitCost: true } })
      : Promise.resolve([]),
  ]);
  const examById = new Map(exams.map((e) => [e.id, e]));
  const surgeryById = new Map(surgeries.map((s) => [s.id, s]));
  const rubricOfAct = new Map(categories.map((a) => [a.code, a.category.rma3IncomeRubric!]));
  // Average purchase cost per article (receipts with a unit cost).
  const costSums = new Map<string, { cost: number; quantity: number }>();
  for (const r of receipts) {
    const sum = costSums.get(r.itemId) ?? { cost: 0, quantity: 0 };
    sum.cost += Number(r.unitCost) * r.quantity;
    sum.quantity += r.quantity;
    costSums.set(r.itemId, sum);
  }
  const averageCost = (itemId: string) => {
    const sum = costSums.get(itemId);
    return sum && sum.quantity > 0 ? sum.cost / sum.quantity : null;
  };

  // Weight of a line in a payment: the payer's share for a settlement, the patient's share for a
  // patient payment — or the whole line when the patient has no share on the invoice (a rejected
  // payer share charged back to the patient).
  const weightOf = (line: IncomeInvoice["lines"][number], payerShare: boolean) =>
    payerShare ? Number(line.payerAmount) : Math.max(0, Number(line.amount) - Number(line.payerAmount) - Number(line.exemptionAmount));
  const toIncome = (p: (typeof payments)[number]): IncomePayment => {
    const patientShareless = !p.payerShare && p.invoice.lines.every((l) => weightOf(l, false) <= 0);
    return {
      amount: Number(p.amount),
      lines: p.invoice.lines.map((line): IncomeLine => {
        // The purchase cost of a pharmacy line is scaled like the line itself.
        const full = Number(line.amount);
        const amount = patientShareless ? full : weightOf(line, p.payerShare);
        const share = full > 0 ? amount / full : 0;
        if (line.sourceType === "pharmacy_dispensation") {
          const itemId = line.sourceId?.split(":")[1] ?? "";
          const cost = averageCost(itemId);
          return { amount, rubric: "pharmacy", purchaseCost: cost === null ? null : cost * Number(line.quantity) * share };
        }
        const exam = line.sourceType === "exam" && line.sourceId ? examById.get(line.sourceId) : undefined;
        // The act behind the line, whose category may carry an RMA3 rubric.
        const actCode =
          line.sourceType === "exam"
            ? exam?.examCode
            : line.sourceType === "surgery"
              ? surgeryById.get(line.sourceId ?? "")?.procedureCode ?? undefined
              : line.sourceType === "consultation"
                ? p.invoice.stay?.medicalActCode ?? undefined
                : undefined;
        const rubric = (actCode && rubricOfAct.get(actCode)) || defaultRubric(line.sourceType, exam?.type);
        return { amount, rubric, purchaseCost: null };
      }),
    };
  };
  // Refunds are spread like the payments they give back, then taken off.
  const totals = allocateIncome(payments.map(toIncome));
  for (const [rubric, value] of Object.entries(allocateIncome(refunds.map(toIncome)))) totals[rubric] = (totals[rubric] ?? 0) - value;
  const otherIncome = unallocated - refundedToPayers;
  if (otherIncome !== 0) totals[UNCLASSIFIED] = (totals[UNCLASSIFIED] ?? 0) + Math.round(otherIncome);
  return totals;
}
