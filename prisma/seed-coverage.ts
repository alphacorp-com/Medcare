// Third-party payment demo data for the patient-journey seed (lib/coverage): payers and their
// conventions, free-care programmes, patient coverages with prior authorizations, an indigent
// enrolment, covered invoices over the current and previous month, and claims at every stage.
//
// Invoices go through the application's own computation (recalculateInvoiceTotals) and claims
// through lib/coverage/claims.ts, so the shares, statuses and receivables are what the app would
// have produced. Facility-level records are created only when the facility has no payer yet;
// coverages and invoices only for the patients of the current run.
import { Gender, type Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { recalculateInvoiceTotals } from '../lib/billing/suggestCharge';
import { applySuccessfulPayment } from '../lib/billing/applyPayment';
import { closeClaim, createClaim, recordPayerPayment, recordRejection, submitClaim } from '../lib/coverage/claims';
import type { ProgramCtx, SeededPatient } from './seed-programs';

const DAY = 86_400_000;
const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}
const ageYears = (p: SeededPatient) => (Date.now() - p.birthDate.getTime()) / (365.25 * DAY);

async function seedPayers(tenantId: string) {
  const types = Object.fromEntries(
    (await prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: 'insurance_type' }, select: { id: true, code: true } })).map((t) => [t.code, t.id])
  );
  const defs = [
    {
      payer: { code: 'CNPS', name: 'CNPS — Caisse Nationale de Prévoyance Sociale', insuranceTypeId: types.CNPS ?? null, contactName: 'Service des prestations', phone: '+237 222 23 40 40' },
      agreement: { code: 'CNPS-STD', name: 'Convention CNPS 2026', defaultRate: 80, annualCeiling: 500000, rates: [{ family: 'pharmacy', rate: 70 }, { family: 'imaging', rate: 70 }] },
    },
    {
      payer: { code: 'MUT-ENS', name: 'Mutuelle des Enseignants du Centre', insuranceTypeId: types.MUTUAL ?? null, contactName: 'Bureau de la mutuelle', phone: '+237 699 11 22 33' },
      agreement: { code: 'MUT-ENS-BASE', name: 'Garantie de base', defaultRate: 70, perInvoiceCeiling: 150000, rates: [{ family: 'surgery', rate: 0 }] },
    },
    {
      payer: { code: 'AXA', name: 'AXA Assurances Cameroun', insuranceTypeId: types.PRIVATE ?? null, contactName: 'Gestion santé', email: 'sante@axa-demo.example' },
      agreement: { code: 'AXA-GOLD', name: 'Contrat santé Gold', defaultRate: 90, annualCeiling: 2000000, requiresAuthorization: true, authorizationThreshold: 100000, rates: [{ family: 'pharmacy', rate: 80 }] },
    },
    {
      payer: { code: 'SONARA', name: 'SONARA — Personnel et ayants droit', insuranceTypeId: types.EMPLOYER ?? null, contactName: 'Direction des ressources humaines' },
      agreement: { code: 'SONARA-PERS', name: 'Prise en charge du personnel', defaultRate: 100, requiresAuthorization: true, authorizationThreshold: null, rates: [{ family: 'pharmacy', rate: 80 }] },
    },
  ] as const;
  const agreements: Record<string, { id: string; payerId: string }> = {};
  for (const d of defs) {
    const payer = await prisma.payer.create({ data: { tenantId, ...d.payer } });
    const { rates, ...fields } = d.agreement;
    const agreement = await prisma.coverageAgreement.create({
      data: { tenantId, payerId: payer.id, validFrom: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)), ...fields, rates: { create: rates.map((r) => ({ tenantId, ...r })) } },
    });
    agreements[d.payer.code] = { id: agreement.id, payerId: payer.id };
  }
  return agreements;
}

async function seedPrograms(tenantId: string) {
  const antimalarials = await prisma.medicationInventory.findMany({ where: { tenantId, OR: [{ name: { contains: 'Coartem' } }, { name: { contains: 'Artesunate' } }, { name: { startsWith: 'TDR' } }] }, select: { id: true } });
  await prisma.exemptionProgram.create({
    data: {
      tenantId, code: 'PALU-5', name: 'Gratuité du paludisme simple chez l’enfant de moins de 5 ans', rate: 100, families: ['laboratory', 'pharmacy'],
      actCodes: ['MALARIA-TDR'], inventoryItemIds: antimalarials.map((a) => a.id), eligibility: 'automatic', maxAgeMonths: 60,
      notes: 'Test de diagnostic rapide et antipaludiques.',
    },
  });
  await prisma.exemptionProgram.create({
    data: { tenantId, code: 'PTME', name: 'PTME — dépistage VIH de la femme enceinte', rate: 100, families: ['laboratory'], actCodes: ['HIV'], eligibility: 'automatic', sex: 'F', pregnantOnly: true },
  });
  return prisma.exemptionProgram.create({
    data: { tenantId, code: 'INDIGENT', name: 'Indigents (enquête sociale)', rate: 100, families: ['consultation', 'laboratory', 'imaging', 'pharmacy', 'hospitalization', 'surgery', 'maternity', 'other'], eligibility: 'enrolment' },
  });
}

let stayCounter = 0;

// An outpatient visit billed like the application does: consultation (stay), a lab exam and,
// for some, a dispensed prescription — then the patient pays their share.
async function coveredVisit(ctx: ProgramCtx, patient: SeededPatient, at: Date, opts: { exam: { code: string; label: string; price: number }; drug?: { id: string; name: string; price: number }; extra?: number; payPatientShare: boolean }) {
  const { tenantId, staff } = ctx;
  stayCounter += 1;
  const stay = await prisma.stay.create({
    data: {
      tenantId, patientId: patient.id, stayNumber: `STCV${String(stayCounter).padStart(4, '0')}`, type: 'outpatient', status: 'discharged', admissionDate: at, dischargeDate: new Date(at.getTime() + 3_600_000),
      departmentId: ctx.departments['MED']?.id ?? null, attendingDoctorId: staff.doctor.id, admissionReason: 'Consultation', medicalActCode: ageYears(patient) < 15 ? 'CONS_PEDIATRIE' : 'CONS_GEN', consultationStatus: 'completed',
    },
  });
  const exam = await prisma.examRequest.create({
    data: { tenantId, patientId: patient.id, stayId: stay.id, prescriberId: staff.doctor.id, type: 'biology', examCode: opts.exam.code, examLabel: opts.exam.label, urgency: 'routine', status: 'completed', requestedAt: at, completedAt: at },
  });
  const coverageId = (await prisma.patientCoverage.findFirst({ where: { tenantId, patientId: patient.id, endedAt: null }, select: { id: true } }))?.id ?? null;
  const invoice = await prisma.patientInvoice.create({ data: { tenantId, patientId: patient.id, stayId: stay.id, status: 'draft', issuedById: staff.billingUser.id, coverageId, createdAt: at } });
  const consultation = ageYears(patient) < 15 ? 8000 : 5000;
  const lines: Prisma.PatientInvoiceLineCreateManyInput[] = [
    { tenantId, invoiceId: invoice.id, sourceType: 'consultation', sourceId: stay.id, description: ageYears(patient) < 15 ? 'Consultation pédiatrique' : 'Consultation générale', quantity: 1, unitPrice: consultation, amount: consultation },
    { tenantId, invoiceId: invoice.id, sourceType: 'exam', sourceId: exam.id, description: opts.exam.label, quantity: 1, unitPrice: opts.exam.price, amount: opts.exam.price },
  ];
  if (opts.drug) {
    const rx = await prisma.prescription.create({
      data: { tenantId, patientId: patient.id, stayId: stay.id, prescriberId: staff.doctor.id, status: 'dispensed', prescribedAt: at, validatedBy: staff.pharmacist.id, validatedAt: at, items: [{ drugCode: opts.drug.id, drugName: opts.drug.name, dosage: 'Selon prescription', quantity: 6 }] as unknown as Prisma.InputJsonValue },
    });
    lines.push({ tenantId, invoiceId: invoice.id, sourceType: 'pharmacy_dispensation', sourceId: `${rx.id}:${opts.drug.id}`, description: opts.drug.name, quantity: 6, unitPrice: opts.drug.price, amount: 6 * opts.drug.price });
  }
  if (opts.extra) lines.push({ tenantId, invoiceId: invoice.id, sourceType: 'other', sourceId: `${invoice.id}:extra`, description: 'Petite chirurgie', quantity: 1, unitPrice: opts.extra, amount: opts.extra });
  await prisma.patientInvoiceLine.createMany({ data: lines });
  const computed = await recalculateInvoiceTotals(invoice.id);
  const share = Number(computed.patientAmount);
  if (opts.payPatientShare && share > 0) {
    await prisma.payment.create({ data: { tenantId, invoiceId: invoice.id, amount: share, method: 'cash', status: 'successful', currency: 'XAF', initiatedById: staff.billingUser.id, initiatedAt: at, completedAt: at } });
    await applySuccessfulPayment(invoice.id, share);
  }
  return invoice.id;
}

export async function seedCoverage(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  if ((await prisma.payer.count({ where: { tenantId } })) > 0) {
    console.log('  Coverage: payers already present — skipped.');
    return;
  }
  const agreements = await seedPayers(tenantId);
  const indigent = await seedPrograms(tenantId);

  // Coverages: adults spread over the four payers, children as dependants of the CNPS.
  const living = ctx.patients.filter((p) => !p.isDeceased);
  const adults = living.filter((p) => ageYears(p) >= 18).slice(0, 32);
  const children = living.filter((p) => ageYears(p) < 5).slice(0, 8);
  const payerOf = ['CNPS', 'CNPS', 'MUT-ENS', 'AXA', 'CNPS', 'SONARA', 'MUT-ENS', 'AXA'];
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const covered: { patient: SeededPatient; payer: string }[] = [];
  for (const [i, patient] of adults.entries()) {
    if (i % 5 === 4) continue; // a fifth pays alone
    const payer = payerOf[i % payerOf.length];
    const coverage = await prisma.patientCoverage.create({
      data: {
        tenantId, patientId: patient.id, agreementId: agreements[payer].id, memberNumber: `${payer}-${String(100000 + i * 37).slice(0, 6)}`,
        employer: payer === 'SONARA' ? 'SONARA Limbé' : payer === 'MUT-ENS' ? 'Lycée Général Leclerc' : null, validFrom: yearStart, createdById: staff.billingUser.id,
      },
    });
    covered.push({ patient, payer });
    // Prior authorizations for the conventions that require one — but the first SONARA member
    // has none yet (their invoices show "authorization required").
    const firstSonara = payer === 'SONARA' && !covered.slice(0, -1).some((c) => c.payer === 'SONARA');
    if ((payer === 'SONARA' && !firstSonara) || payer === 'AXA') {
      await prisma.coverageAuthorization.create({
        data: { tenantId, coverageId: coverage.id, number: `BON-${payer}-${String(i + 1).padStart(4, '0')}`, authorizedAmount: payer === 'SONARA' ? 60000 : 250000, validFrom: day(daysAgo(60)), validTo: day(daysAgo(-30)), createdById: staff.billingUser.id },
      });
    }
  }
  for (const [i, child] of children.entries()) {
    const principal = covered.find((c) => c.payer === 'CNPS' && c.patient.gender === (i % 2 ? Gender.F : Gender.M)) ?? covered[0];
    if (!principal) break;
    await prisma.patientCoverage.create({
      data: { tenantId, patientId: child.id, agreementId: agreements.CNPS.id, memberNumber: `CNPS-AD-${String(i + 1).padStart(3, '0')}`, principalName: `${principal.patient.lastName} ${principal.patient.firstName}`, relationship: 'enfant', validFrom: yearStart, createdById: staff.billingUser.id },
    });
  }
  // An expired coverage (for the "invalid coverage" status) and an indigent enrolment.
  const uncovered = adults.filter((_, i) => i % 5 === 4);
  if (uncovered[0]) {
    await prisma.patientCoverage.create({ data: { tenantId, patientId: uncovered[0].id, agreementId: agreements['MUT-ENS'].id, memberNumber: 'MUT-ENS-EXPIRED', validFrom: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1)), validTo: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 11, 31)), createdById: staff.billingUser.id } });
  }
  if (uncovered[1]) {
    await prisma.patientExemption.create({ data: { tenantId, patientId: uncovered[1].id, programId: indigent.id, validFrom: day(daysAgo(90)), reason: 'Enquête sociale n°2026-014 — sans ressources', grantedById: staff.billingUser.id } });
  }

  // Covered visits over the two months (patient pays their share), children with a malaria RDT.
  const coartem = await prisma.medicationInventory.findFirst({ where: { tenantId, name: { contains: 'Coartem' } }, select: { id: true, name: true } });
  const amox = await prisma.medicationInventory.findFirst({ where: { tenantId, name: { contains: 'Amoxicillin' } }, select: { id: true, name: true } });
  const invoiceIds: string[] = [];
  const visitors = [...covered.map((c) => c.patient), ...children, ...uncovered.slice(0, 2)];
  for (const [i, patient] of visitors.entries()) {
    const kid = ageYears(patient) < 5;
    const at = daysAgo(3 + ((i * 5) % 50), 9 + (i % 6));
    const exam = kid ? { code: 'MALARIA-TDR', label: 'Paludisme (TDR)', price: 1500 } : i % 3 === 0 ? { code: 'CBC', label: 'Numération formule sanguine (NFS)', price: 4000 } : { code: 'MALARIA-TDR', label: 'Paludisme (TDR)', price: 1500 };
    const drug = kid && coartem ? { ...coartem, price: 350 } : amox && i % 2 === 0 ? { ...amox, price: 150 } : undefined;
    // AXA / SONARA patients: some heavier invoices, above the authorization threshold.
    const extra = i % 7 === 0 ? 120000 : undefined;
    invoiceIds.push(await coveredVisit(ctx, patient, at, { exam, drug, extra, payPatientShare: i % 6 !== 5 }));
  }

  // Claims of the previous month: CNPS submitted, partially settled, one rejection charged to the
  // patient; AXA settled and closed; the current month of the Mutual still in draft.
  const now = new Date();
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const eligibleOf = async (payer: string, from: Date, to: Date) =>
    (await prisma.patientInvoice.findMany({
      where: { tenantId, id: { in: invoiceIds }, insuranceAmount: { gt: 0 }, status: { not: 'cancelled' }, coverage: { agreement: { payerId: agreements[payer].payerId } }, createdAt: { gte: from, lt: new Date(to.getTime() + DAY) } },
      select: { id: true, insuranceAmount: true },
      orderBy: { createdAt: 'asc' },
    }));
  let claims = 0;
  const cnps = await eligibleOf('CNPS', prevStart, prevEnd);
  if (cnps.length > 0) {
    const claim = await createClaim(tenantId, staff.billingUser.id, { payerId: agreements.CNPS.payerId, periodStart: prevStart, periodEnd: prevEnd, invoiceIds: cnps.map((i) => i.id), notes: 'Bordereau mensuel CNPS' });
    await submitClaim(tenantId, claim.id);
    const total = cnps.reduce((s, i) => s + Number(i.insuranceAmount), 0);
    await recordPayerPayment(tenantId, staff.billingUser.id, { payerId: agreements.CNPS.payerId, claimId: claim.id, amount: Math.round(total * 0.6), receivedAt: day(daysAgo(4)), method: 'bank_transfer', reference: 'VIR-CNPS-0926', notes: 'Acompte', allocations: null });
    const items = await prisma.insuranceClaimItem.findMany({ where: { claimId: claim.id }, orderBy: { createdAt: 'desc' }, take: 1 });
    const last = items[0];
    if (last) {
      const left = Number(last.claimedAmount) - Number(last.paidAmount) - Number(last.rejectedAmount);
      if (left > 0) await recordRejection(tenantId, claim.id, last.id, { amount: Math.min(left, 2000), reason: 'Ordonnance non jointe', chargeToPatient: true });
    }
    claims += 1;
  }
  const axa = await eligibleOf('AXA', prevStart, prevEnd);
  if (axa.length > 0) {
    const claim = await createClaim(tenantId, staff.billingUser.id, { payerId: agreements.AXA.payerId, periodStart: prevStart, periodEnd: prevEnd, invoiceIds: axa.map((i) => i.id), notes: null });
    await submitClaim(tenantId, claim.id);
    await recordPayerPayment(tenantId, staff.billingUser.id, { payerId: agreements.AXA.payerId, claimId: claim.id, amount: axa.reduce((s, i) => s + Number(i.insuranceAmount), 0), receivedAt: day(daysAgo(2)), method: 'cheque', reference: 'CHQ-AXA-55120', notes: null, allocations: null });
    await closeClaim(tenantId, claim.id);
    claims += 1;
  }
  const mutual = await eligibleOf('MUT-ENS', monthStart, now);
  if (mutual.length > 0) {
    await createClaim(tenantId, staff.billingUser.id, { payerId: agreements['MUT-ENS'].payerId, periodStart: monthStart, periodEnd: day(now), invoiceIds: mutual.map((i) => i.id), notes: 'En préparation' });
    claims += 1;
  }
  console.log(`  Coverage: 4 payers, 3 free-care programmes, ${covered.length + children.length} coverages, ${invoiceIds.length} covered invoices, ${claims} claims.`);
}
