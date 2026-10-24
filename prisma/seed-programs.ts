// Programme and RMA3 module data for the patient-journey seed (prisma/seed-patient-journeys.ts):
// EPI sessions / cold chain / AEFI, HIV-PMTCT-hepatitis-STI, mother and child (PMTCT, Td, postnatal,
// family planning), nutrition and growth, oxygen, blood bank, HR register, TB screening and case
// complements, chronic care, civil registration, pharmacovigilance, ICD-10 diagnoses, RMA3 stock
// articles, RMA3 identification and monthly form, staff rosters and messaging, and third-party
// payment (prisma/seed-coverage.ts).
//
// Every builder works on the patients created by the current run (`SeededPatient`), so a re-run
// that only adds patients never duplicates programme data of earlier patients. Facility-level
// records (equipment, donors, staff register, sessions, RMA3 periods…) are keyed by code or
// created only when the facility has none yet.
//
// Events are spread over the current and the previous month: the RMA3 is reported for the month
// that just ended and the registers open on the current month.
import {
  Gender,
  Prisma,
  ShiftType,
  type DiagnosisContext,
  type FpClientStatus,
  type NutritionExitReason,
  type ScreeningEntryPoint,
  type ScreeningResult,
  type ScreeningTestType,
} from '@prisma/client';
import prisma from '../lib/prisma';
import { consumeStock, receiveStock } from '../lib/stock/movements';
import { STAFF_CADRES } from '../lib/hr/cadres';
import { IDENTIFICATION_KEY } from '../lib/rma3-manual/data';
import { BREAKDOWN_COLUMNS, RMA3_MANUAL_SECTIONS } from '../lib/rma3-manual/catalog';
import { syncExamFeeSchedule } from '../lib/billing/syncFeeSchedule';
import { seedCoverage } from './seed-coverage';

export interface SeededPatient {
  id: string;
  ipp: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  gender: Gender;
  journey: string;
  isDeceased: boolean;
}

export interface ProgramStaff {
  doctor: { id: string };
  doctor2: { id: string };
  nurse: { id: string };
  pharmacist: { id: string };
  labTech: { id: string };
  radiologist: { id: string };
  billingUser: { id: string };
  dataManager: { id: string };
}

export interface ProgramCtx {
  tenantId: string;
  staff: ProgramStaff;
  departments: Record<string, { id: string }>;
  patients: SeededPatient[];
}

const DAY = 86_400_000;

function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const ageYears = (p: SeededPatient, at = new Date()) => (at.getTime() - p.birthDate.getTime()) / (365.25 * DAY);
const ageDays = (p: SeededPatient, at: Date) => Math.max(0, Math.floor((at.getTime() - p.birthDate.getTime()) / DAY));
// Spreads the i-th event over the last ~55 days (current and previous month).
const spread = (i: number, max = 55) => 1 + ((i * 7) % max);
const json = (value: unknown) => value as Prisma.InputJsonValue;

const living = (ctx: ProgramCtx) => ctx.patients.filter((p) => !p.isDeceased);
const children = (ctx: ProgramCtx) => living(ctx).filter((p) => ageYears(p) < 5);
const womenOfReproductiveAge = (ctx: ProgramCtx) => living(ctx).filter((p) => p.gender === Gender.F && ageYears(p) >= 15 && ageYears(p) < 50);
const adults = (ctx: ProgramCtx) => living(ctx).filter((p) => ageYears(p) >= 15);

// ─────────────────────────────────────────────────────────────────────────
// ICD-10 diagnoses on the stays (morbidity, causes of consultation /
// hospitalisation / death in the RMA3) and the "national protocol" box.
// ─────────────────────────────────────────────────────────────────────────

const JOURNEY_DIAGNOSES: Record<string, [string, string][]> = {
  emergencyMinor: [['S61', 'Plaie ouverte du poignet et de la main'], ['S93', 'Entorse de la cheville'], ['R50', "Fièvre d'origine inconnue"]],
  emergencyCritical: [['S36', 'Lésion traumatique des organes intra-abdominaux']],
  chronicFollowUp: [['I10', 'Hypertension essentielle'], ['E11', 'Diabète sucré de type 2']],
  dayCare: [['A09', 'Diarrhée et gastro-entérite infectieuse présumée'], ['J45', 'Asthme']],
  transferred: [['I63', 'Infarctus cérébral']],
  deceased: [['I21', 'Infarctus aigu du myocarde']],
  outpatientPaid: [['J06', 'Infections aiguës des voies respiratoires supérieures'], ['K29', 'Gastrite et duodénite'], ['N39', 'Infection urinaire'], ['M54', 'Dorsalgie']],
  labWorkup: [['D64', 'Anémie'], ['E78', 'Hyperlipidémie']],
  radiologyWorkup: [['J18', 'Pneumopathie'], ['K80', 'Lithiase biliaire']],
  maternityDelivered: [['O80', 'Accouchement unique et spontané']],
  malariaSimple: [['B54', 'Paludisme, sans précision']],
  malariaSevere: [['B50', 'Paludisme à Plasmodium falciparum']],
  tbCase: [['A15', 'Tuberculose respiratoire confirmée']],
  billingPartiallyPaid: [['J02', 'Pharyngite aiguë']],
  billingFailedPayment: [['L03', 'Cellulite']],
  billingCancelled: [['R51', 'Céphalée']],
};
// Children under 5: the PCIMNE conditions (III.7) instead of the adult picture.
const CHILD_DIAGNOSES: [string, string][] = [['A09', 'Diarrhée et gastro-entérite infectieuse présumée'], ['J18', 'Pneumopathie'], ['B54', 'Paludisme, sans précision'], ['J06', 'Infections aiguës des voies respiratoires supérieures']];
// Adolescents (10-19): STIs managed per the national protocol (III.8) among common complaints.
const ADOLESCENT_DIAGNOSES: [string, string][] = [['A54', 'Infection gonococcique'], ['J06', 'Infections aiguës des voies respiratoires supérieures'], ['A56', 'Infection à Chlamydia transmise par voie sexuelle'], ['D50', 'Anémie par carence en fer']];

// Prescription of RMA3-tagged articles on a stay: the report reads the treatments of the stays
// from their prescriptions (lib/reports/rma3-coded-data.ts).
async function prescribeOnStay(ctx: ProgramCtx, stay: { id: string; patientId: string; admissionDate: Date }, items: { id: string; name: string }[], dosage: string) {
  await prisma.prescription.create({
    data: {
      tenantId: ctx.tenantId, patientId: stay.patientId, stayId: stay.id, prescriberId: ctx.staff.doctor.id, status: 'dispensed', prescribedAt: stay.admissionDate,
      validatedBy: ctx.staff.pharmacist.id, validatedAt: stay.admissionDate,
      items: json(items.map((a) => ({ drugCode: a.id, drugName: a.name, dosage, quantity: 10 }))),
    },
  });
}

async function seedDiagnoses(ctx: ProgramCtx, articles: Record<string, { id: string; name: string }>) {
  const ors = articles['SRO (sels de réhydratation orale) sachet'];
  const zinc = articles['Zinc 20 mg comprimé dispersible'];
  const amoxicillin = articles['Amoxicilline 250 mg comprimé dispersible (pneumonie enfant)'];
  const iron = articles['Fer + acide folique comprimé'];
  const byId = new Map(ctx.patients.map((p) => [p.id, p]));
  const stays = await prisma.stay.findMany({
    where: { tenantId: ctx.tenantId, patientId: { in: [...byId.keys()] }, diagnoses: { none: {} } },
    select: { id: true, patientId: true, status: true, admissionDate: true, dischargeDate: true, type: true },
  });
  let n = 0;
  for (const stay of stays) {
    const patient = byId.get(stay.patientId)!;
    const age = ageYears(patient, stay.admissionDate);
    const isChild = age < 5;
    const isAdolescent = age >= 10 && age < 20 && stay.type === 'outpatient';
    const options = isChild ? CHILD_DIAGNOSES : isAdolescent ? ADOLESCENT_DIAGNOSES : JOURNEY_DIAGNOSES[patient.journey];
    if (!options) continue;
    const [code, label] = options[n % options.length];
    const context: DiagnosisContext = stay.status === 'deceased' ? 'death' : stay.status === 'discharged' && stay.type !== 'outpatient' ? 'discharge' : 'consultation';
    await prisma.diagnosis.create({
      data: {
        tenantId: ctx.tenantId, patientId: stay.patientId, stayId: stay.id, context, kind: 'principal', icd10Code: code, label,
        isNewCase: n % 4 !== 0, recordedById: ctx.staff.doctor.id, recordedAt: stay.dischargeDate ?? stay.admissionDate,
      },
    });
    // Hypertensive diabetics carry both conditions.
    if (patient.journey === 'chronicFollowUp' && code === 'I10' && n % 2 === 0) {
      await prisma.diagnosis.create({ data: { tenantId: ctx.tenantId, patientId: stay.patientId, stayId: stay.id, context, kind: 'secondary', icd10Code: 'E11', label: 'Diabète sucré de type 2', isNewCase: false, recordedById: ctx.staff.doctor.id, recordedAt: stay.admissionDate } });
    }
    // Road accident: external cause V01-V89 (RMA3 V.1) next to the injury.
    if (patient.journey === 'emergencyCritical') {
      await prisma.diagnosis.create({ data: { tenantId: ctx.tenantId, patientId: stay.patientId, stayId: stay.id, context, kind: 'secondary', icd10Code: 'V89', label: 'Accident de véhicule à moteur', recordedById: ctx.staff.doctor.id, recordedAt: stay.admissionDate } });
    }
    // RMA3 III.7-006 / III.8-002: consultations managed per the national protocol (most of them).
    if ((isChild || isAdolescent) && n % 3 !== 0) {
      await prisma.stay.update({ where: { id: stay.id }, data: { followedNationalProtocol: true } });
    }
    // PCIMNE treatments (III.7): ORS (+ zinc) for diarrhoea, antibiotic for pneumonia.
    if (isChild && code === 'A09') await prescribeOnStay(ctx, stay, n % 4 === 0 ? [ors] : [ors, zinc], '1 sachet après chaque selle liquide');
    if (isChild && code === 'J18' && n % 3 !== 2) await prescribeOnStay(ctx, stay, [amoxicillin], '1 comprimé 2x/jour pendant 5 jours');
    // Iron / folic acid for adolescent girls (III.8-003).
    if (isAdolescent && patient.gender === Gender.F) await prescribeOnStay(ctx, stay, [iron], '1 comprimé/jour');
    n += 1;
  }
  console.log(`  Diagnoses: ${n} stays coded (ICD-10).`);
}

// ─────────────────────────────────────────────────────────────────────────
// Stock: RMA3-tagged articles (tracers, EPI inputs, antimalarials, oxygen,
// nutrition, ORS / zinc / iron) with receipts, consumption and losses.
// ─────────────────────────────────────────────────────────────────────────

interface ArticleSeed {
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  threshold: number;
  rma3Category?: string;
  rma3Treatment?: string;
  vaccineAntigenCode?: string;
  dosesPerUnit?: number;
  openVialHours?: number;
  receipts: { quantity: number; daysAgo: number; unitCost: number; lot: string; expiresInDays: number }[];
  consumed: number[];
  lost?: { quantity: number; type: 'expired' | 'damaged' | 'lost' };
}

const RMA3_ARTICLES: ArticleSeed[] = [
  { name: 'SRO (sels de réhydratation orale) sachet', category: 'Réhydratation', unit: 'sachets', unitPrice: 150, threshold: 100, rma3Category: 'tracer', rma3Treatment: 'ors', receipts: [{ quantity: 500, daysAgo: 50, unitCost: 80, lot: 'SRO-2609', expiresInDays: 500 }], consumed: [40, 25, 30] },
  { name: 'Zinc 20 mg comprimé dispersible', category: 'Réhydratation', unit: 'comprimés', unitPrice: 50, threshold: 100, rma3Category: 'tracer', rma3Treatment: 'zinc', receipts: [{ quantity: 600, daysAgo: 50, unitCost: 25, lot: 'ZN-2609', expiresInDays: 400 }], consumed: [60, 40] },
  { name: 'Amoxicilline 250 mg comprimé dispersible (pneumonie enfant)', category: 'Antibiotic', unit: 'comprimés', unitPrice: 75, threshold: 150, rma3Category: 'tracer', rma3Treatment: 'antibiotic', receipts: [{ quantity: 800, daysAgo: 45, unitCost: 40, lot: 'AMX-2609', expiresInDays: 600 }], consumed: [80, 60, 45] },
  { name: 'Fer + acide folique comprimé', category: 'Antianémique', unit: 'comprimés', unitPrice: 25, threshold: 200, rma3Category: 'tracer', rma3Treatment: 'iron_folate', receipts: [{ quantity: 2000, daysAgo: 52, unitCost: 10, lot: 'FAF-2609', expiresInDays: 700 }], consumed: [150, 120] },
  { name: 'Sulfadoxine-Pyriméthamine (SP) comprimé', category: 'Antimalarial', unit: 'comprimés', unitPrice: 100, threshold: 150, rma3Category: 'antimalarial', receipts: [{ quantity: 900, daysAgo: 40, unitCost: 50, lot: 'SP-2609', expiresInDays: 500 }], consumed: [90, 60] },
  { name: 'TDR paludisme (test)', category: 'Antimalarial', unit: 'tests', unitPrice: 500, threshold: 100, rma3Category: 'antimalarial', receipts: [{ quantity: 400, daysAgo: 48, unitCost: 300, lot: 'TDR-2609', expiresInDays: 300 }], consumed: [55, 70], lost: { quantity: 10, type: 'damaged' } },
  { name: 'Vaccin BCG (flacon 20 doses)', category: 'Vaccin', unit: 'flacons', unitPrice: 0, threshold: 5, rma3Category: 'epi_input', vaccineAntigenCode: 'BCG', dosesPerUnit: 20, openVialHours: 6, receipts: [{ quantity: 20, daysAgo: 44, unitCost: 2500, lot: 'BCG-2609', expiresInDays: 300 }], consumed: [3, 2], lost: { quantity: 1, type: 'expired' } },
  { name: 'Vaccin Penta (DTC-HepB-Hib) flacon 1 dose', category: 'Vaccin', unit: 'flacons', unitPrice: 0, threshold: 20, rma3Category: 'epi_input', vaccineAntigenCode: 'PENTA1', dosesPerUnit: 1, receipts: [{ quantity: 120, daysAgo: 44, unitCost: 1800, lot: 'PEN-2609', expiresInDays: 400 }], consumed: [20, 15] },
  { name: 'Vaccin VPO (flacon 20 doses)', category: 'Vaccin', unit: 'flacons', unitPrice: 0, threshold: 5, rma3Category: 'epi_input', vaccineAntigenCode: 'OPV1', dosesPerUnit: 20, openVialHours: 672, receipts: [{ quantity: 15, daysAgo: 44, unitCost: 2000, lot: 'VPO-2609', expiresInDays: 360 }], consumed: [2, 1] },
  { name: 'Seringue autobloquante 0,5 ml', category: 'Consommable PEV', unit: 'seringues', unitPrice: 0, threshold: 200, rma3Category: 'epi_input', receipts: [{ quantity: 1500, daysAgo: 44, unitCost: 60, lot: 'SAB-2609', expiresInDays: 900 }], consumed: [120, 90] },
  { name: "Bouteille d'oxygène 7,5 m³", category: 'Oxygène', unit: 'bouteilles', unitPrice: 25000, threshold: 4, rma3Category: 'oxygen', receipts: [{ quantity: 12, daysAgo: 35, unitCost: 18000, lot: 'O2-2609', expiresInDays: 1800 }], consumed: [3, 2] },
  { name: 'ATPE (Plumpy\'Nut) sachet 92 g', category: 'Nutrition', unit: 'sachets', unitPrice: 0, threshold: 150, rma3Category: 'nutrition', receipts: [{ quantity: 900, daysAgo: 42, unitCost: 350, lot: 'ATPE-2609', expiresInDays: 365 }], consumed: [140, 120] },
  { name: 'Lait thérapeutique F-75 boîte', category: 'Nutrition', unit: 'boîtes', unitPrice: 0, threshold: 10, rma3Category: 'nutrition', receipts: [{ quantity: 40, daysAgo: 42, unitCost: 6000, lot: 'F75-2609', expiresInDays: 365 }], consumed: [6, 4] },
  { name: 'Ténofovir+Lamivudine+Dolutégravir (TLD) boîte 30', category: 'Antirétroviral', unit: 'boîtes', unitPrice: 0, threshold: 20, rma3Category: 'tracer', receipts: [{ quantity: 150, daysAgo: 46, unitCost: 4500, lot: 'TLD-2609', expiresInDays: 700 }], consumed: [18, 22] },
];

async function seedRma3Articles(ctx: ProgramCtx): Promise<Record<string, { id: string; name: string }>> {
  const byName: Record<string, { id: string; name: string }> = {};
  let created = 0;
  for (const a of RMA3_ARTICLES) {
    const existing = await prisma.medicationInventory.findFirst({ where: { tenantId: ctx.tenantId, name: a.name }, select: { id: true, name: true } });
    // An article left without any movement by an interrupted run gets its stock now.
    if (existing && (await prisma.stockMovement.count({ where: { itemId: existing.id } })) > 0) {
      byName[a.name] = existing;
      continue;
    }
    const item = existing ?? await prisma.medicationInventory.create({
      data: {
        tenantId: ctx.tenantId, name: a.name, manufacturer: 'Generic', category: a.category, unit: a.unit, unitPrice: a.unitPrice, threshold: a.threshold,
        rma3Category: a.rma3Category ?? null, rma3Treatment: a.rma3Treatment ?? null, vaccineAntigenCode: a.vaccineAntigenCode ?? null,
        dosesPerUnit: a.dosesPerUnit ?? 1, openVialHours: a.openVialHours ?? null,
      },
      select: { id: true, name: true },
    });
    // Stock only moves through the application's movement functions (lots, balances, CMM).
    for (const r of a.receipts) {
      await prisma.$transaction((tx) =>
        receiveStock(tx, {
          tenantId: ctx.tenantId, userId: ctx.staff.pharmacist.id, itemId: item.id, lotNumber: r.lot,
          expiryDate: addDays(new Date(), r.expiresInDays), quantity: r.quantity, unitCost: r.unitCost,
          reason: 'Réception de démonstration', occurredAt: daysAgo(r.daysAgo, 8, 0),
        })
      );
    }
    for (const [i, quantity] of a.consumed.entries()) {
      await prisma.$transaction((tx) =>
        consumeStock(tx, { tenantId: ctx.tenantId, userId: ctx.staff.pharmacist.id, itemId: item.id, quantity, type: a.vaccineAntigenCode ? 'vaccination' : 'dispensing', sourceType: 'seed', occurredAt: daysAgo(35 - i * 12, 11, 0) })
      );
    }
    if (a.lost) {
      const lost = a.lost;
      await prisma.$transaction((tx) =>
        consumeStock(tx, { tenantId: ctx.tenantId, userId: ctx.staff.pharmacist.id, itemId: item.id, quantity: lost.quantity, type: lost.type, sourceType: 'seed', reason: 'Perte de démonstration', occurredAt: daysAgo(6, 16, 0) })
      );
    }
    byName[a.name] = item;
    created += 1;
  }
  console.log(`  Stock: ${created} RMA3 articles created (${RMA3_ARTICLES.length} ensured).`);
  return byName;
}

// ─────────────────────────────────────────────────────────────────────────
// EPI: sessions, cold chain, extra doses (TPIn, MILDA, deworming, vitamin A,
// out-of-schedule, special populations) and AEFI.
// ─────────────────────────────────────────────────────────────────────────

async function seedEpi(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  let sessions = await prisma.vaccinationSession.findMany({ where: { tenantId }, select: { id: true, status: true, strategy: true, scheduledDate: true } });
  if (sessions.length === 0) {
    const defs = [
      { d: 50, strategy: 'fixed', site: 'Centre de santé — salle PEV', status: 'held' },
      { d: 43, strategy: 'outreach', site: 'Village Nkolbisson', status: 'held' },
      { d: 36, strategy: 'fixed', site: 'Centre de santé — salle PEV', status: 'held' },
      { d: 29, strategy: 'outreach', site: 'Quartier Mvog-Betsi', status: 'cancelled' },
      { d: 22, strategy: 'fixed', site: 'Centre de santé — salle PEV', status: 'held' },
      { d: 15, strategy: 'outreach', site: 'Village Ebolowa-Si', status: 'held' },
      { d: 8, strategy: 'fixed', site: 'Centre de santé — salle PEV', status: 'held' },
      { d: 1, strategy: 'outreach', site: 'Campement de réfugiés de Gado', status: 'held' },
      { d: -3, strategy: 'fixed', site: 'Centre de santé — salle PEV', status: 'planned' },
      { d: -10, strategy: 'outreach', site: 'Village Nkolbisson', status: 'planned' },
    ] as const;
    for (const s of defs) {
      await prisma.vaccinationSession.create({
        data: {
          tenantId, scheduledDate: daysAgo(s.d, 0, 0), strategy: s.strategy, site: s.site, status: s.status,
          heldAt: s.status === 'held' ? daysAgo(s.d, 9, 0) : null, notes: s.status === 'cancelled' ? 'Annulée — rupture de vaccins.' : null, createdById: staff.nurse.id,
        },
      });
    }
    sessions = await prisma.vaccinationSession.findMany({ where: { tenantId }, select: { id: true, status: true, strategy: true, scheduledDate: true } });
  }
  const held = sessions.filter((s) => s.status === 'held' && s.scheduledDate.getTime() <= Date.now());

  // Cold chain: 3 devices, twice-daily readings over 30 days, a few alarms.
  if ((await prisma.coldChainEquipment.count({ where: { tenantId } })) === 0) {
    const location = await prisma.storageLocation.findFirst({ where: { tenantId, code: 'COLD_CHAIN' }, select: { id: true } });
    const devices = [
      { code: 'REF-01', type: 'refrigerator', label: 'Réfrigérateur solaire TCW 40', status: 'functional', min: 2, max: 8 },
      { code: 'CONG-01', type: 'freezer', label: 'Congélateur à accumulateurs', status: 'functional', min: -25, max: -15 },
      { code: 'CAISSE-01', type: 'cold_box', label: 'Caisse isotherme (stratégie avancée)', status: 'needs_repair', min: 2, max: 8 },
    ] as const;
    for (const dev of devices) {
      const equipment = await prisma.coldChainEquipment.create({ data: { tenantId, code: dev.code, type: dev.type, label: dev.label, locationId: location?.id ?? null, minTempC: dev.min, maxTempC: dev.max, status: dev.status } });
      if (dev.type === 'cold_box') continue;
      for (let day = 30; day >= 0; day--) {
        for (const hour of [8, 16]) {
          const mid = (dev.min + dev.max) / 2;
          // One low and one high alarm on the refrigerator.
          const alarm = dev.type === 'refrigerator' && ((day === 12 && hour === 8) || (day === 4 && hour === 16));
          const temperature = alarm ? (day === 12 ? 1.2 : 9.4) : mid + (((day * 3 + hour) % 5) - 2) * 0.6;
          await prisma.coldChainReading.create({ data: { tenantId, equipmentId: equipment.id, readAt: daysAgo(day, hour, 0), temperatureC: Math.round(temperature * 10) / 10, notes: alarm ? 'Alarme — porte mal fermée, corrigé.' : null, recordedById: staff.nurse.id } });
        }
      }
    }
  }

  // Doses: under-fives get the routine schedule over the two months, through the sessions.
  const schedule = [
    { code: 'PENTA2', name: 'Penta 2 (DTC+HepB+Hib)', dose: 2 },
    { code: 'OPV2', name: 'VPO2', dose: 2 },
    { code: 'PCV2', name: 'Pneumocoque (PCV-13) 2', dose: 2 },
    { code: 'ROTA2', name: 'Rotavirus 2', dose: 2 },
    { code: 'TPIN1', name: 'TPIn 1', dose: 1 },
    { code: 'RR1', name: 'Rougeole-Rubéole 1', dose: 1 },
    { code: 'VAA', name: 'Fièvre jaune (VAA)', dose: 1 },
    { code: 'MILDA', name: 'MILDA (remise lors de la vaccination)', dose: 1 },
    { code: 'VITA', name: 'Vitamine A', dose: 1 },
    { code: 'DEWORM', name: 'Mébendazole / Albendazole (déparasitage)', dose: 1 },
  ];
  const kids = children(ctx);
  const immunizations: { id: string; patientId: string; administeredAt: Date }[] = [];
  for (const [k, child] of kids.entries()) {
    for (let j = 0; j < 3; j++) {
      const dose = schedule[(k * 3 + j) % schedule.length];
      const session = held[(k + j) % Math.max(1, held.length)];
      const at = session ? new Date(session.scheduledDate.getTime() + 9.5 * 3_600_000) : daysAgo(spread(k + j), 10, 0);
      if (at.getTime() < child.birthDate.getTime()) continue;
      const imm = await prisma.immunization.create({
        data: {
          tenantId, patientId: child.id, antigenCode: dose.code, antigenName: dose.name, doseNumber: dose.dose, administeredAt: at, administeredById: staff.nurse.id,
          ageInDaysAtAdministration: ageDays(child, at), lotNumber: `${dose.code}-2609`, expiryDate: addDays(new Date(), 300),
          strategy: session?.strategy ?? 'fixed', sessionId: session?.id ?? null,
          populationGroup: k % 7 === 3 ? 'refugee' : k % 7 === 5 ? 'nomad' : 'general', isOutOfSchedule: ageYears(child, at) >= 2 && k % 2 === 0,
        },
        select: { id: true, patientId: true, administeredAt: true },
      });
      immunizations.push(imm);
    }
  }
  // AEFI: two minor, one serious (hospitalised, recovered).
  for (const [i, imm] of immunizations.filter((_, idx) => idx % 9 === 4).slice(0, 3).entries()) {
    await prisma.aefiReport.create({
      data: {
        tenantId, patientId: imm.patientId, immunizationId: imm.id, onsetAt: new Date(imm.administeredAt.getTime() + 6 * 3_600_000),
        seriousness: i === 2 ? 'serious' : 'minor', outcome: i === 0 ? 'recovered' : i === 1 ? 'recovering' : 'recovered', hospitalized: i === 2,
        description: i === 2 ? 'Convulsions fébriles 6 h après la vaccination, hospitalisation 24 h.' : 'Fièvre modérée et douleur au point d’injection.', reportedById: staff.nurse.id,
      },
    });
  }
  console.log(`  EPI: ${sessions.length} sessions, ${immunizations.length} doses for ${kids.length} children, cold chain ready.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Mother and child: PMTCT status, Td from the antenatal visit, postnatal
// visits, family planning (women and men).
// ─────────────────────────────────────────────────────────────────────────

async function seedMotherChild(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const ids = ctx.patients.map((p) => p.id);
  const pregnancies = await prisma.pregnancy.findMany({
    where: { tenantId, patientId: { in: ids } },
    select: { id: true, patientId: true, status: true, delivery: { select: { deliveryDate: true } }, antenatalVisits: { select: { id: true, visitNumber: true, visitDate: true, gestationalAgeWeeks: true }, orderBy: { visitDate: 'asc' } } },
  });
  let td = 0;
  let postnatal = 0;
  for (const [i, pregnancy] of pregnancies.entries()) {
    await prisma.pmtctPregnancyStatus.upsert({
      where: { pregnancyId: pregnancy.id },
      update: {},
      create: { tenantId, pregnancyId: pregnancy.id, hivKnownPositiveAtEntry: i % 5 === 2, onArtAtEntry: i % 5 === 2, hbvKnownPositiveAtEntry: i % 7 === 3, updatedById: staff.doctor.id },
    });
    // Ongoing pregnancies: the last visit gets haemoglobin and outreach, and a new visit this month
    // brings Td, an ITN and IPTp (II.1.1, IV.2.1, IV.2.2-3).
    const patient = ctx.patients.find((p) => p.id === pregnancy.patientId)!;
    const last = pregnancy.antenatalVisits.at(-1);
    if (pregnancy.status === 'ongoing' && last) {
      await prisma.antenatalVisit.update({ where: { id: last.id }, data: { strategy: i % 2 === 0 ? 'outreach' : 'fixed', hemoglobinGPerDl: 10.2 + (i % 4) * 0.7, itnGiven: true } });
      const visitDate = daysAgo(8 + (i % 6), 10, 0);
      const visit = await prisma.antenatalVisit.create({
        data: {
          tenantId, pregnancyId: pregnancy.id, visitNumber: last.visitNumber + 1, visitDate, gestationalAgeWeeks: last.gestationalAgeWeeks + 3, performedById: staff.doctor.id,
          bloodPressureSystolic: 112 + (i % 3) * 4, bloodPressureDiastolic: 72, ironFolateGiven: true, malariaPreventionGiven: true, itnGiven: i % 2 === 1,
          tetanusVaccineGiven: true, strategy: i % 3 === 0 ? 'outreach' : 'fixed', hemoglobinGPerDl: 11 + (i % 3) * 0.5,
        },
      });
      // Td: the Immunization record is the source of truth, linked from the antenatal visit.
      const imm = await prisma.immunization.create({
        data: { tenantId, patientId: patient.id, antigenCode: 'TD', antigenName: 'Td (tétanos-diphtérie)', doseNumber: 2 + (i % 3), administeredAt: visitDate, administeredById: staff.nurse.id, ageInDaysAtAdministration: ageDays(patient, visitDate), lotNumber: 'TD-2609' },
      });
      await prisma.antenatalVisit.update({ where: { id: visit.id }, data: { tdImmunizationId: imm.id } });
      td += 1;
    }
    // Postnatal visits (J3 and J7) for the delivered pregnancies.
    if (pregnancy.status === 'delivered' && pregnancy.delivery?.deliveryDate) {
      for (const day of [3, 7]) {
        const at = addDays(pregnancy.delivery.deliveryDate, day);
        if (at.getTime() > Date.now()) continue;
        await prisma.postnatalVisit.create({ data: { tenantId, pregnancyId: pregnancy.id, visitDate: at, vitaminAGiven: day === 3, ironFolateGiven: true, breastfeedingCounseling: true, newbornExamined: true, performedById: staff.nurse.id } });
        postnatal += 1;
      }
      await prisma.delivery.update({ where: { pregnancyId: pregnancy.id }, data: { amtsl: true, breastfeedingStart: i % 3 === 0 ? 'within_1_hour' : 'within_30_min' } });
    }
  }

  // Family planning: new and continuing users, women and a few men, implants / IUD procedures.
  const methods: { code: string; procedure?: 'implant_insertion' | 'implant_removal' | 'iud_insertion' | 'iud_removal' }[] = [
    { code: 'injectable' }, { code: 'coc' }, { code: 'implant', procedure: 'implant_insertion' }, { code: 'male_condom' }, { code: 'iud', procedure: 'iud_insertion' },
    { code: 'pop' }, { code: 'lam' }, { code: 'implant', procedure: 'implant_removal' }, { code: 'standard_days' }, { code: 'tubal_ligation' },
  ];
  const deliveryDates = new Map(pregnancies.filter((p) => p.delivery?.deliveryDate).map((p) => [p.patientId, p.delivery!.deliveryDate!]));
  // The delivered mothers first, so every one of them is offered a post-partum method.
  const fpWomen = womenOfReproductiveAge(ctx).sort((x, y) => Number(deliveryDates.has(y.id)) - Number(deliveryDates.has(x.id))).slice(0, 18);
  const fpMen = adults(ctx).filter((p) => p.gender === Gender.M && ageYears(p) < 60).slice(0, 4);
  let fp = 0;
  const postpartumMethods = methods.filter((m) => ['implant', 'injectable', 'iud', 'pop'].includes(m.code) && m.procedure !== 'implant_removal');
  for (const [i, woman] of fpWomen.entries()) {
    // A post-partum mother gets a method offered after a delivery.
    const m = deliveryDates.has(woman.id) && woman.journey === 'maternityDelivered' ? postpartumMethods[i % postpartumMethods.length] : methods[i % methods.length];
    const status: FpClientStatus = i % 3 === 0 ? 'continuing_user' : 'new_user';
    // Post-partum method: chosen two days after the delivery.
    const delivered = deliveryDates.get(woman.id);
    const at = delivered && woman.journey === 'maternityDelivered' ? new Date(Math.min(addDays(delivered, 2).getTime(), Date.now())) : daysAgo(spread(i), 10, 30);
    await prisma.familyPlanningVisit.create({
      data: {
        tenantId, patientId: woman.id, visitDate: at, clientStatus: status, counseled: true, methodCode: m.code, procedure: m.procedure ?? null,
        isPostpartum: Boolean(delivered && woman.journey === 'maternityDelivered'), referredByChw: i % 4 === 1, nextDueDate: m.code === 'injectable' ? addDays(at, 90) : null, performedById: staff.nurse.id,
        sideEffects: i % 6 === 5 ? 'Saignements irréguliers' : null,
      },
    });
    fp += 1;
    // A follow-up visit a month later for the injectables (continuing user).
    if (m.code === 'injectable' && spread(i) > 30) {
      await prisma.familyPlanningVisit.create({ data: { tenantId, patientId: woman.id, visitDate: addDays(at, 28), clientStatus: 'continuing_user', counseled: false, methodCode: 'injectable', performedById: staff.nurse.id } });
      fp += 1;
    }
  }
  for (const [i, man] of fpMen.entries()) {
    await prisma.familyPlanningVisit.create({ data: { tenantId, patientId: man.id, visitDate: daysAgo(spread(i + 3), 15, 0), clientStatus: 'new_user', counseled: true, methodCode: i === 3 ? 'vasectomy' : 'male_condom', referredByChw: i % 2 === 0, performedById: staff.nurse.id } });
    fp += 1;
  }
  console.log(`  Mother-child: ${pregnancies.length} PMTCT statuses, ${td} Td doses, ${postnatal} postnatal visits, ${fp} FP visits.`);
}

// ─────────────────────────────────────────────────────────────────────────
// HIV, PMTCT, hepatitis and STI.
// ─────────────────────────────────────────────────────────────────────────

async function seedHiv(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const pool = adults(ctx);
  const entryPoints: ScreeningEntryPoint[] = ['outpatient', 'vct', 'antenatal', 'inpatient', 'emergency', 'tb', 'sti', 'family_planning', 'community', 'index_case'];
  const pregnancyByPatient = new Map(
    (await prisma.pregnancy.findMany({ where: { tenantId, patientId: { in: pool.map((p) => p.id) } }, select: { id: true, patientId: true } })).map((p) => [p.patientId, p.id])
  );
  let tests = 0;
  const positives: { patient: SeededPatient; testedAt: Date; entryPoint: ScreeningEntryPoint; pregnancyId: string | null }[] = [];
  for (const [i, patient] of pool.slice(0, 45).entries()) {
    const pregnancyId = pregnancyByPatient.get(patient.id) ?? null;
    const entryPoint: ScreeningEntryPoint = pregnancyId ? 'antenatal' : patient.journey === 'tbCase' ? 'tb' : entryPoints[i % entryPoints.length];
    const result: ScreeningResult = i % 6 === 1 || patient.journey === 'tbCase' ? 'positive' : i % 17 === 9 ? 'indeterminate' : 'negative';
    const testedAt = daysAgo(spread(i), 10, 0);
    await prisma.screeningTest.create({
      data: { tenantId, patientId: patient.id, testType: 'hiv', testedAt, result, entryPoint, pregnancyId, resultCollectedAt: i % 8 === 7 ? null : addDays(testedAt, 0), referralSource: i % 5 === 0 ? 'asc' : 'none', recordedById: staff.labTech.id },
    });
    tests += 1;
    if (result === 'positive') positives.push({ patient, testedAt, entryPoint, pregnancyId });
  }

  // Other screenings: syphilis, hepatitis B/C, STIs (some treated).
  const others: { type: ScreeningTestType; positiveEvery: number }[] = [
    { type: 'syphilis', positiveEvery: 6 }, { type: 'hbsag', positiveEvery: 5 }, { type: 'hcv', positiveEvery: 9 }, { type: 'chlamydia', positiveEvery: 4 }, { type: 'gonorrhea', positiveEvery: 5 },
  ];
  const hepatitisPositives: { patient: SeededPatient; type: 'hbv' | 'hcv'; at: Date }[] = [];
  for (const [i, patient] of pool.slice(5, 35).entries()) {
    const other = others[i % others.length];
    // The tests rotate over the types: every `positiveEvery`-th round of a type is positive.
    const positive = Math.floor(i / others.length) % other.positiveEvery === 0;
    const testedAt = daysAgo(spread(i + 2), 11, 0);
    await prisma.screeningTest.create({
      data: {
        tenantId, patientId: patient.id, testType: other.type, testedAt, result: positive ? 'positive' : 'negative', entryPoint: other.type === 'syphilis' && pregnancyByPatient.has(patient.id) ? 'antenatal' : 'sti',
        pregnancyId: other.type === 'syphilis' ? pregnancyByPatient.get(patient.id) ?? null : null, treatedAt: positive && other.type !== 'hbsag' && other.type !== 'hcv' ? addDays(testedAt, 1) : null, recordedById: staff.labTech.id,
      },
    });
    tests += 1;
    if (positive && other.type === 'hbsag') hepatitisPositives.push({ patient, type: 'hbv', at: testedAt });
    if (positive && other.type === 'hcv') hepatitisPositives.push({ patient, type: 'hcv', at: testedAt });
  }

  // Care: the positives enrol on ART with monthly visits and a viral load.
  let enrolments = 0;
  for (const [i, pos] of positives.entries()) {
    const exists = await prisma.hivCareEnrolment.findUnique({ where: { tenantId_patientId: { tenantId, patientId: pos.patient.id } }, select: { id: true } });
    if (exists) continue;
    const startedAt = addDays(pos.testedAt, i % 3 === 0 ? 0 : 7);
    if (startedAt.getTime() > Date.now()) continue;
    const status = i === positives.length - 1 && i > 3 ? 'transferred_out' : 'active';
    const enrolment = await prisma.hivCareEnrolment.create({
      data: {
        tenantId, patientId: pos.patient.id, hivDiagnosisDate: pos.testedAt, artStartDate: startedAt, enrolledAt: startedAt, entryPoint: pos.entryPoint, pregnancyId: pos.pregnancyId,
        transferIn: i % 6 === 4 ? 'in_country' : null, status, statusChangedAt: status === 'transferred_out' ? daysAgo(3, 0, 0) : null, transferOut: status === 'transferred_out' ? 'in_country' : null, createdById: staff.doctor.id,
      },
    });
    for (let v = 0; v < 3; v++) {
      const visitDate = addDays(startedAt, v * 30);
      if (visitDate.getTime() > Date.now()) break;
      const symptomatic = v === 0 && i % 4 === 1;
      await prisma.artVisit.create({
        data: {
          tenantId, enrolmentId: enrolment.id, visitDate, regimenCode: i % 5 === 3 ? 'AZT-3TC-LPVr' : 'TDF-3TC-DTG', regimenLine: i % 5 === 3 ? 2 : 1, daysDispensed: v === 0 ? 30 : 90,
          nextAppointmentDate: addDays(visitDate, v === 0 ? 30 : 90), tbScreened: true, tbSymptomsPositive: symptomatic, tbTested: symptomatic, tbConfirmed: symptomatic && pos.patient.journey === 'tbCase',
          tbTreatmentStarted: symptomatic && pos.patient.journey === 'tbCase', iptStarted: !symptomatic && v === 0, recordedById: staff.doctor.id,
        },
      });
    }
    await prisma.viralLoadResult.create({
      data: { tenantId, patientId: pos.patient.id, program: 'hiv', sampledAt: addDays(startedAt, 25), value: i % 3 === 0 ? 12500 : null, belowDetection: i % 3 !== 0, pregnancyId: pos.pregnancyId, recordedById: staff.labTech.id },
    });
    enrolments += 1;
  }

  // Emergency ARV supplies for travellers from another site.
  if ((await prisma.artEmergencySupply.count({ where: { tenantId } })) === 0 && pool.length > 2) {
    for (const [i, patient] of pool.slice(-2).entries()) {
      await prisma.artEmergencySupply.create({ data: { tenantId, patientId: patient.id, supplyDate: daysAgo(spread(i + 5), 0, 0), regimenCode: 'TDF-3TC-DTG', regimenLine: 1, daysDispensed: 14, originSite: i === 0 ? 'Hôpital de district de Bafia' : 'CMA de Nkoabang', recordedById: staff.doctor.id } });
    }
  }

  // HIV-exposed infants: under-ones born to a seropositive mother.
  const infants = children(ctx).filter((c) => ageYears(c) < 1).slice(0, 3);
  const mothers = positives.filter((p) => p.patient.gender === Gender.F);
  let exposed = 0;
  for (const [i, infant] of infants.entries()) {
    const already = await prisma.hivExposedInfant.findUnique({ where: { patientId: infant.id }, select: { id: true } });
    if (already) continue;
    const firstSeen = addDays(infant.birthDate, 1);
    await prisma.hivExposedInfant.create({
      data: {
        tenantId, patientId: infant.id, motherPatientId: mothers[i % Math.max(1, mothers.length)]?.patient.id ?? null, bornInFacility: i !== 2, firstSeenAt: firstSeen,
        nevirapineStartedAt: firstSeen, cotrimoxazoleStartedAt: addDays(infant.birthDate, 42).getTime() <= Date.now() ? addDays(infant.birthDate, 42) : null,
        visit6to8WeeksAt: addDays(infant.birthDate, 45).getTime() <= Date.now() ? addDays(infant.birthDate, 45) : null, createdById: staff.doctor.id,
      },
    });
    if (addDays(infant.birthDate, 42).getTime() <= Date.now()) {
      await prisma.screeningTest.create({ data: { tenantId, patientId: infant.id, testType: 'hiv_pcr', testedAt: addDays(infant.birthDate, 42), result: 'negative', entryPoint: 'pediatric', recordedById: staff.labTech.id } });
    }
    exposed += 1;
  }

  // Hepatitis cases from the positive screenings.
  let hepatitis = 0;
  for (const [i, h] of hepatitisPositives.entries()) {
    const exists = await prisma.hepatitisCase.findUnique({ where: { tenantId_patientId_type: { tenantId, patientId: h.patient.id, type: h.type } }, select: { id: true } });
    if (exists) continue;
    await prisma.hepatitisCase.create({
      data: { tenantId, patientId: h.patient.id, type: h.type, diagnosedAt: h.at, deltaPositive: h.type === 'hbv' ? i % 3 === 0 : null, eligibleAt: i % 2 === 0 ? addDays(h.at, 7) : null, treatmentStartedAt: i % 2 === 0 ? addDays(h.at, 10) : null, createdById: staff.doctor.id },
    });
    if (i % 2 === 0) await prisma.viralLoadResult.create({ data: { tenantId, patientId: h.patient.id, program: h.type, sampledAt: addDays(h.at, 5), value: 2400 + i * 300, recordedById: staff.labTech.id } });
    hepatitis += 1;
  }
  console.log(`  HIV/STI: ${tests} screenings, ${enrolments} ART enrolments, ${exposed} exposed infants, ${hepatitis} hepatitis cases.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Malaria and TB complements on the cases created by the journeys.
// ─────────────────────────────────────────────────────────────────────────

async function seedMalariaTbComplements(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const ids = ctx.patients.map((p) => p.id);
  const malaria = await prisma.malariaCase.findMany({ where: { tenantId, patientId: { in: ids } }, select: { id: true, severity: true } });
  const species = ['falciparum', 'falciparum', 'falciparum', 'mixed', 'malariae'] as const;
  for (const [i, c] of malaria.entries()) {
    const severe = c.severity === 'severe';
    await prisma.malariaCase.update({
      where: { id: c.id },
      data: { species: species[i % species.length], treatment: severe ? 'artesunate_inj' : i % 2 === 0 ? 'al' : 'asaq', hospitalized: severe, freeOfCharge: i % 3 === 0 },
    });
  }

  // TB cases: TB-RR with second line, cotrimoxazole for the co-infected, a health worker.
  const tbCases = await prisma.tbCase.findMany({ where: { tenantId, patientId: { in: ids } }, select: { id: true, notificationDate: true }, orderBy: { notificationDate: 'asc' } });
  for (const [i, c] of tbCases.entries()) {
    const rr = i % 3 === 1;
    const secondLine = rr ? addDays(c.notificationDate, 5) : null;
    await prisma.tbCase.update({
      where: { id: c.id },
      data: {
        rifampicinResistant: rr, secondLineStartedAt: secondLine && secondLine.getTime() <= Date.now() ? secondLine : null,
        cotrimoxazole: i % 2 === 0, isHealthWorker: i % 3 === 2, hivStatus: i % 2 === 0 ? 'positive' : 'negative',
      },
    });
  }

  // Active case finding: screened, presumptive, sent to the lab, tested, TPT for contacts.
  let screenings = 0;
  for (const [i, patient] of adults(ctx).slice(0, 40).entries()) {
    const screenedAt = daysAgo(spread(i), 9, 30);
    const presumptive = i % 3 === 0 || patient.journey === 'tbCase';
    const sent = presumptive && i % 4 !== 3 ? addDays(screenedAt, 0) : null;
    const tested = sent && i % 5 !== 4 ? addDays(sent, 2) : null;
    await prisma.tbScreening.create({
      data: {
        tenantId, patientId: patient.id, screenedAt, presumptive, sentToLabAt: sent, testedAt: tested && tested.getTime() <= Date.now() ? tested : null,
        testPositive: tested && tested.getTime() <= Date.now() ? patient.journey === 'tbCase' : null, tptStartedAt: !presumptive && i % 7 === 2 ? addDays(screenedAt, 3) : null,
        notes: !presumptive && i % 7 === 2 ? 'Contact familial d’un cas index — TPT.' : null, recordedById: staff.nurse.id,
      },
    });
    screenings += 1;
  }
  console.log(`  Malaria/TB: ${malaria.length} malaria cases completed, ${tbCases.length} TB cases completed, ${screenings} TB screenings.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Nutrition (PCIMA CNA / CNTI) and growth monitoring.
// ─────────────────────────────────────────────────────────────────────────

async function seedNutrition(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const kids = children(ctx).filter((c) => ageYears(c) >= 0.5);
  const exits: (NutritionExitReason | null)[] = ['cured', null, 'defaulted', 'cured', null, 'non_responder', 'transfer_out', null];
  let cases = 0;
  for (const [i, child] of kids.slice(0, 8).entries()) {
    const admittedAt = daysAgo(50 - i * 5, 10, 0);
    const exit = exits[i % exits.length];
    await prisma.nutritionCase.create({
      data: {
        tenantId, patientId: child.id, program: i % 3 === 0 ? 'cnti' : 'cna', admittedAt, admissionType: i % 5 === 4 ? 'relapse' : 'new_case', criterion: i % 3 === 1 ? 'whz' : i % 3 === 2 ? 'oedema' : 'muac',
        muacMm: 105 + (i % 4) * 4, whz: i % 3 === 1 ? -3.2 : null, residency: i % 6 === 5 ? 'refugee' : 'resident', hivTested: i % 2 === 0, anjeCounseling: true,
        exitedAt: exit ? addDays(admittedAt, 35) : null, exitReason: exit, recordedById: staff.nurse.id,
      },
    });
    cases += 1;
  }
  let visits = 0;
  for (const [i, child] of children(ctx).entries()) {
    const months = ageYears(child) * 12;
    for (const d of [spread(i, 25) + 28, spread(i, 25)]) {
      const at = daysAgo(d, 10, 0);
      if (at.getTime() < child.birthDate.getTime()) continue;
      const m = Math.max(0, months - d / 30);
      await prisma.growthMonitoringVisit.create({
        data: {
          tenantId, patientId: child.id, visitDate: at, weightKg: Math.round((3.3 + m * 0.45) * 10) / 10, heightCm: Math.round((50 + m * 1.6) * 10) / 10, muacMm: m >= 6 ? 125 + (i % 3) * 5 : null, counseling: true,
          exclusiveBreastfeeding: m < 6 ? i % 4 !== 0 : null, receivesWater: m < 6 ? i % 4 === 0 : null, complementaryFood: m >= 6 && m < 24 ? true : null, stillBreastfed: m >= 6 && m < 24 ? i % 3 !== 0 : null,
          multivitaminGiven: m >= 6 && i % 2 === 0, recordedById: staff.nurse.id,
        },
      });
      visits += 1;
    }
  }
  console.log(`  Nutrition: ${cases} PCIMA cases, ${visits} growth visits.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Oxygen: biomedical equipment and hypoxaemia episodes.
// ─────────────────────────────────────────────────────────────────────────

async function seedOxygen(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const equipment = [
    { code: 'OXY-01', type: 'pulse_oximeter', label: 'Oxymètre de pouls — urgences', location: 'Urgences', status: 'functional' },
    { code: 'OXY-02', type: 'pulse_oximeter', label: 'Oxymètre de pouls — pédiatrie', location: 'Pédiatrie', status: 'functional' },
    { code: 'OXY-03', type: 'pulse_oximeter', label: 'Oxymètre de pouls — maternité', location: 'Maternité', status: 'broken' },
    { code: 'CONC-01', type: 'oxygen_concentrator', label: "Concentrateur d'oxygène 10 L", location: 'Urgences', status: 'functional' },
    { code: 'CONC-02', type: 'oxygen_concentrator', label: "Concentrateur d'oxygène 5 L", location: 'Médecine', status: 'maintenance' },
    { code: 'VENT-01', type: 'ventilator', label: 'Respirateur de transport', location: 'Bloc opératoire', status: 'functional' },
    { code: 'BOUT-01', type: 'oxygen_cylinder_7500', label: "Bouteille d'oxygène 7 500 L n°1", location: 'Urgences', status: 'functional' },
    { code: 'BOUT-02', type: 'oxygen_cylinder_7500', label: "Bouteille d'oxygène 7 500 L n°2", location: 'Maternité', status: 'functional' },
  ] as const;
  for (const e of equipment) {
    await prisma.biomedicalEquipment.upsert({
      where: { tenantId_code: { tenantId, code: e.code } },
      update: {},
      create: { tenantId, code: e.code, type: e.type, label: e.label, location: e.location, status: e.status, serialNumber: `SN-${e.code}-2025` },
    });
  }
  const candidates = living(ctx).filter((p) => ['emergencyCritical', 'malariaSevere', 'radiologyWorkup', 'maternityDelivered'].includes(p.journey) || ageYears(p) < 5).slice(0, 10);
  const outcomes = ['cured', 'cured', 'referred', 'cured', null, 'left_against_advice', 'cured', 'died'] as const;
  for (const [i, patient] of candidates.entries()) {
    const stay = await prisma.stay.findFirst({ where: { tenantId, patientId: patient.id }, select: { id: true, admissionDate: true }, orderBy: { admissionDate: 'desc' } });
    const detectedAt = stay?.admissionDate ?? daysAgo(spread(i), 14, 0);
    const outcome = outcomes[i % outcomes.length];
    await prisma.hypoxemiaEpisode.create({
      data: {
        tenantId, patientId: patient.id, stayId: stay?.id ?? null, detectedAt, spo2: 78 + (i % 4) * 3, respiratoryDistress: i % 2 === 0, deliveryRoom: patient.journey === 'maternityDelivered',
        oxygenGiven: outcome !== 'left_against_advice', outcome, outcomeAt: outcome ? addDays(detectedAt, 2) : null, recordedById: staff.nurse.id,
      },
    });
  }
  console.log(`  Oxygen: ${equipment.length} devices, ${candidates.length} hypoxaemia episodes.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Blood bank: donors, a mobile session, donations across the workflow.
// ─────────────────────────────────────────────────────────────────────────

async function seedBloodBank(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  if ((await prisma.bloodDonor.count({ where: { tenantId } })) > 0) {
    console.log('  Blood bank: donors already present — skipped.');
    return;
  }
  const donorNames = [
    ['Atangana Eric', Gender.M, 'O+'], ['Mbida Clarisse', Gender.F, 'A+'], ['Ngono Patrick', Gender.M, 'B+'], ['Essomba Lydie', Gender.F, 'O-'],
    ['Tchinda Boris', Gender.M, 'AB+'], ['Ewodo Martine', Gender.F, 'O+'], ['Fokou Arnaud', Gender.M, 'A-'], ['Nkolo Viviane', Gender.F, 'B-'],
    ['Abessolo Jules', Gender.M, 'O+'], ['Moukoko Irène', Gender.F, 'A+'], ['Ndzana Hugues', Gender.M, 'O+'], ['Ayissi Rachel', Gender.F, 'B+'],
  ] as const;
  const session = await prisma.bloodCollectionSession.create({ data: { tenantId, heldAt: daysAgo(20, 9, 0), location: 'Collecte mobile — Université de Yaoundé I' } });
  const session2 = await prisma.bloodCollectionSession.create({ data: { tenantId, heldAt: daysAgo(48, 9, 0), location: 'Collecte mobile — Paroisse Saint-Joseph' } });
  const recipients = living(ctx).filter((p) => ['surgeryCompleted', 'emergencyCritical', 'maternityDelivered', 'malariaSevere'].includes(p.journey));
  for (const [i, [name, sex, group]] of donorNames.entries()) {
    const donor = await prisma.bloodDonor.create({
      data: { tenantId, code: `DON-${String(i + 1).padStart(4, '0')}`, fullName: name, sex, birthDate: daysAgo(365 * (22 + i * 2), 0, 0), phone: `+237 699 20 ${String(10 + i).padStart(2, '0')} 00`, bloodGroup: group, donorType: i % 3 === 2 ? 'family' : 'voluntary' },
    });
    const collectedAt = i < 6 ? daysAgo(20, 9, 30 + i) : i < 9 ? daysAgo(48, 10, i) : daysAgo(spread(i), 11, 0);
    // Workflow: quarantine (untested), available, served, transfused, destroyed (positive test).
    const stage = i % 6;
    const positive = stage === 5;
    const tested = stage !== 0;
    const recipient = stage === 4 ? recipients[i % Math.max(1, recipients.length)] : undefined;
    await prisma.bloodDonation.create({
      data: {
        tenantId, donorId: donor.id, sessionId: i < 6 ? session.id : i < 9 ? session2.id : null, bagNumber: `SANG-26-${String(i + 1).padStart(4, '0')}`, collectedAt,
        hivResult: tested ? (positive && i % 2 === 1 ? 'positive' : 'negative') : 'not_done', hbvResult: tested ? (positive && i % 2 === 0 ? 'positive' : 'negative') : 'not_done',
        hcvResult: tested ? 'negative' : 'not_done', syphilisResult: tested ? 'negative' : 'not_done',
        status: stage === 0 ? 'quarantine' : stage === 1 || stage === 2 ? 'available' : stage === 3 ? 'served' : stage === 4 && recipient ? 'transfused' : positive ? 'destroyed' : 'available',
        servedAt: stage === 3 || (stage === 4 && recipient) ? addDays(collectedAt, 3) : null, transfusedAt: stage === 4 && recipient ? addDays(collectedAt, 3) : null, recipientPatientId: recipient?.id ?? null,
        destroyedAt: positive ? addDays(collectedAt, 1) : null, destructionReason: positive ? 'Test de dépistage positif' : null, recordedById: staff.labTech.id,
      },
    });
  }
  console.log(`  Blood bank: ${donorNames.length} donors, 2 mobile sessions, donations across all statuses.`);
}

// ─────────────────────────────────────────────────────────────────────────
// HR register (RMA3 VI.5), linked to the application users where they exist.
// ─────────────────────────────────────────────────────────────────────────

async function seedStaffRegister(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  if ((await prisma.staffMember.count({ where: { tenantId } })) > 0) {
    console.log('  HR register: already present — skipped.');
    return;
  }
  const users = [staff.doctor, staff.doctor2, staff.nurse, staff.pharmacist, staff.labTech, staff.radiologist, staff.billingUser, staff.dataManager];
  const userRecords = await prisma.tenantUser.findMany({ where: { id: { in: users.map((u) => u.id) } }, select: { id: true, fullName: true } });
  const names = ['Mbassi Rose', 'Onguene Brice', 'Kana Estelle', 'Ndongo Fabrice', 'Bella Nicole', 'Etoa Gaston', 'Mvogo Prisca', 'Nganou Didier', 'Ebode Laure', 'Kom Yannick', 'Ngoa Pélagie', 'Zambo Ludovic', 'Akono Mireille', 'Mfoumou Ernest', 'Tsala Agnès', 'Ondobo Cyrille', 'Mebenga Florence', 'Assako Raoul'];
  const cadreFor = (i: number) => STAFF_CADRES[i % STAFF_CADRES.length].code;
  let n = 0;
  for (const [i, user] of userRecords.entries()) {
    await prisma.staffMember.create({ data: { tenantId, fullName: user.fullName, sex: i % 2 === 0 ? Gender.M : Gender.F, cadre: cadreFor(i), payer: i % 3 === 2 ? 'local' : 'state', birthDate: daysAgo(365 * (30 + i * 3), 0, 0), hiredAt: daysAgo(365 * (2 + i), 0, 0), tenantUserId: user.id } });
    n += 1;
  }
  for (const [i, name] of names.entries()) {
    const k = i + userRecords.length;
    const left = i === 4 || i === 11;
    await prisma.staffMember.create({
      data: {
        tenantId, fullName: name, sex: i % 2 === 0 ? Gender.F : Gender.M, cadre: cadreFor(k), payer: i % 3 === 0 ? 'local' : 'state', inPost: !left,
        birthDate: daysAgo(365 * (25 + ((i * 5) % 35)), 0, 0), hiredAt: daysAgo(365 * (1 + (i % 12)), 0, 0),
        retirementDate: i === 7 ? addDays(new Date(), 200) : null, leftAt: left ? daysAgo(spread(i), 0, 0) : null, notes: left ? 'Mutation' : null,
      },
    });
    n += 1;
  }
  console.log(`  HR register: ${n} staff members.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Chronic care register (diabetes, hypertension).
// ─────────────────────────────────────────────────────────────────────────

async function seedChronicCare(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const candidates = living(ctx).filter((p) => p.journey === 'chronicFollowUp' || (ageYears(p) >= 45 && ['outpatientPaid', 'labWorkup', 'radiologyWorkup', 'dayCare'].includes(p.journey)));
  let enrolments = 0;
  let visits = 0;
  for (const [i, patient] of candidates.entries()) {
    const conditions: ('diabetes' | 'hypertension')[] = patient.journey === 'chronicFollowUp' && i % 2 === 0 ? ['hypertension', 'diabetes'] : [i % 2 === 0 ? 'hypertension' : 'diabetes'];
    for (const condition of conditions) {
      const enrolledAt = daysAgo(120 + i * 9, 10, 0);
      const exited = i === 3;
      const enrolment = await prisma.chronicCareEnrolment.create({
        data: { tenantId, patientId: patient.id, condition, enrolledAt, exitedAt: exited ? daysAgo(12, 10, 0) : null, exitReason: exited ? 'lost_to_follow_up' : null, recordedById: staff.doctor.id },
      });
      enrolments += 1;
      for (const d of [45, 15].map((x) => x + (i % 6))) {
        if (exited && d < 12) continue;
        const controlled = (i + d) % 3 !== 0;
        await prisma.chronicCareVisit.create({
          data: {
            tenantId, enrolmentId: enrolment.id, visitDate: daysAgo(d, 9, 0), onTreatment: i % 5 !== 4,
            systolic: condition === 'hypertension' ? (controlled ? 132 : 158) : 125, diastolic: condition === 'hypertension' ? (controlled ? 84 : 98) : 80,
            hba1c: condition === 'diabetes' ? (controlled ? 6.8 : 8.9) : null, educationIndividual: d % 2 === 1, educationGroup: d % 3 === 0, recordedById: staff.nurse.id,
          },
        });
        visits += 1;
      }
    }
  }
  console.log(`  Chronic care: ${enrolments} enrolments, ${visits} visits.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Civil registration (births, deaths) and pharmacovigilance.
// ─────────────────────────────────────────────────────────────────────────

async function seedCivilAndPharmacovigilance(ctx: ProgramCtx, articles: Record<string, { id: string; name: string }>) {
  const { tenantId, staff } = ctx;
  const ids = ctx.patients.map((p) => p.id);
  const newborns = await prisma.newborn.findMany({ where: { tenantId, delivery: { pregnancy: { patientId: { in: ids } } }, patient: { isNot: null } }, select: { patient: { select: { id: true, firstName: true, lastName: true, birthDate: true } } } });
  let declarations = 0;
  for (const [i, nb] of newborns.entries()) {
    if (!nb.patient || i % 4 === 3) continue; // a few still to transmit
    const transmitted = addDays(nb.patient.birthDate, 2);
    await prisma.civilRegistrationDeclaration.create({
      data: { tenantId, type: 'birth', patientId: nb.patient.id, personName: `${nb.patient.lastName} ${nb.patient.firstName}`, eventDate: nb.patient.birthDate, transmittedAt: transmitted.getTime() > Date.now() ? new Date() : transmitted, reference: `NAIS-${String(i + 1).padStart(4, '0')}`, recordedById: staff.dataManager.id },
    });
    declarations += 1;
  }
  const deceased = ctx.patients.filter((p) => p.isDeceased);
  for (const [i, p] of deceased.entries()) {
    const patient = await prisma.patient.findUnique({ where: { id: p.id }, select: { deceasedAt: true } });
    if (!patient?.deceasedAt) continue;
    await prisma.civilRegistrationDeclaration.create({
      data: { tenantId, type: 'death', patientId: p.id, personName: `${p.lastName} ${p.firstName}`, eventDate: patient.deceasedAt, transmittedAt: addDays(patient.deceasedAt, 3), reference: `DEC-${String(i + 1).padStart(4, '0')}`, recordedById: staff.dataManager.id },
    });
    declarations += 1;
  }

  // Adverse drug reactions, from stock articles and free-text drugs.
  const pool = adults(ctx).slice(10, 16);
  const reactions = [
    { article: 'Amoxicilline 250 mg comprimé dispersible (pneumonie enfant)', description: 'Éruption cutanée prurigineuse 24 h après la première prise.', serious: false, investigated: true },
    { article: 'Sulfadoxine-Pyriméthamine (SP) comprimé', description: 'Réaction cutanée bulleuse étendue — suspicion de syndrome de Stevens-Johnson.', serious: true, investigated: true },
    { drug: 'Quinine injectable 300 mg', description: 'Hypoglycémie symptomatique après perfusion.', serious: true, investigated: false },
    { article: 'Ténofovir+Lamivudine+Dolutégravir (TLD) boîte 30', description: 'Insomnie et céphalées persistantes.', serious: false, investigated: false },
    { drug: 'Métronidazole 500 mg', description: 'Goût métallique et nausées.', serious: false, investigated: true },
  ];
  let n = 0;
  for (const [i, r] of reactions.entries()) {
    const patient = pool[i % Math.max(1, pool.length)];
    if (!patient) break;
    const article = r.article ? articles[r.article] : undefined;
    const at = daysAgo(spread(i + 1), 15, 0);
    await prisma.drugAdverseReaction.create({
      data: {
        tenantId, patientId: patient.id, inventoryId: article?.id ?? null, drugName: article?.name ?? r.drug ?? 'Médicament', lotNumber: article ? `LOT-${i + 1}` : null,
        expiryDate: article ? addDays(new Date(), 300) : null, reactionAt: at, description: r.description, serious: r.serious,
        investigatedAt: r.investigated ? addDays(at, 2) : null, outcome: r.investigated ? (r.serious ? 'Imputabilité probable — notifié au programme national' : 'Imputabilité possible') : null, recordedById: staff.pharmacist.id,
        // Notified the day of the reaction: the RMA3 (V.8) counts the notifications of the month.
        createdAt: at,
      },
    });
    n += 1;
  }
  console.log(`  Civil registration: ${declarations} declarations; pharmacovigilance: ${n} reactions.`);
}

// ─────────────────────────────────────────────────────────────────────────
// RMA3: identification (if not yet filled) and the monthly form — previous
// month validated, current month in draft.
// ─────────────────────────────────────────────────────────────────────────

function periodOf(monthsBack: number): string {
  const d = new Date();
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1));
  return `${m.getUTCFullYear()}${String(m.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function seedRma3(ctx: ProgramCtx) {
  const { tenantId, staff } = ctx;
  const identification = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key: IDENTIFICATION_KEY } } });
  if (!identification) {
    await prisma.tenantSetting.create({
      data: {
        tenantId, key: IDENTIFICATION_KEY, updatedBy: staff.dataManager.id,
        value: json({ region: 'Centre', department: 'Mfoundi', arrondissement: 'Yaoundé III', district: 'Efoulan', healthArea: 'Nsam', villagesServed: 14, villagesOutreach: 6, ownership: 'faith_based', dataManagerName: 'Hélène Bikoula', dataManagerPhone: '+237 677 55 44 33', facilityManagerName: 'Dr. Paul Mendo' }),
      },
    });
  }
  for (const [monthsBack, status] of [[1, 'validated'], [0, 'draft']] as const) {
    const period = periodOf(monthsBack);
    if (await prisma.rma3ManualPeriod.findUnique({ where: { tenantId_period: { tenantId, period } } })) continue;
    const created = await prisma.rma3ManualPeriod.create({
      data: { tenantId, period, status, validatedById: status === 'validated' ? staff.dataManager.id : null, validatedAt: status === 'validated' ? daysAgo(20, 17, 0) : null },
    });
    const values: Prisma.Rma3ManualValueCreateManyInput[] = [];
    let k = 0;
    for (const section of RMA3_MANUAL_SECTIONS) {
      for (const indicator of section.indicators) {
        k += 1;
        // The draft month is half filled: the rest stays "not entered".
        if (status === 'draft' && k % 2 === 0) continue;
        for (const [c, column] of BREAKDOWN_COLUMNS[indicator.breakdown].entries()) {
          const value =
            indicator.kind === 'yesNo' ? (k % 3 === 0 ? 0 : 1)
            : indicator.kind === 'amount' ? 50_000 * (1 + ((k + c) % 9))
            : indicator.kind === 'days' ? (k + c) % 4
            : column.key === 'held' ? 3 + (k % 3)
            : column.key === 'planned' ? 5
            : (k * 3 + c * 2) % 13;
          values.push({ tenantId, periodId: created.id, indicatorCode: indicator.code, breakdownKey: column.key, value, updatedById: staff.dataManager.id });
        }
      }
    }
    await prisma.rma3ManualValue.createMany({ data: values });
  }
  console.log(`  RMA3: identification ${identification ? 'kept' : 'filled'}, monthly form ${periodOf(1)} validated / ${periodOf(0)} draft.`);
}

// ─────────────────────────────────────────────────────────────────────────
// Planning (rosters) and messaging between the clinical staff.
// ─────────────────────────────────────────────────────────────────────────

async function seedPlanningAndMessaging(ctx: ProgramCtx) {
  const { tenantId, staff, departments } = ctx;
  if ((await prisma.schedule.count({ where: { tenantId } })) === 0) {
    const rota: { user: { id: string }; dept: string }[] = [
      { user: staff.doctor, dept: 'MED' }, { user: staff.doctor2, dept: 'SURG' }, { user: staff.nurse, dept: 'EMER' }, { user: staff.pharmacist, dept: 'PHAR' }, { user: staff.labTech, dept: 'LAB' },
    ];
    const shifts: [ShiftType, number, number][] = [[ShiftType.morning, 7, 15], [ShiftType.afternoon, 15, 23], [ShiftType.night, 23, 31]];
    for (let d = -7; d <= 14; d++) {
      for (const [i, r] of rota.entries()) {
        const [shift, start, end] = shifts[(i + d + 21) % 3];
        const date = daysAgo(-d, 0, 0);
        await prisma.schedule.create({
          data: { tenantId, userId: r.user.id, departmentId: departments[r.dept].id, shiftType: shift, date, startTime: addDays(date, start / 24), endTime: addDays(date, end / 24), status: d < 0 ? 'confirmed' : 'planned' },
        });
      }
    }
  }
  if ((await prisma.conversation.count({ where: { tenantId } })) === 0) {
    const threads = [
      { title: null, isGroup: false, members: [staff.doctor, staff.nurse], messages: ['Le patient du box 4 est stable, tension 110/70.', 'Merci, je passe le revoir à 14 h.'] },
      { title: 'Équipe PEV', isGroup: true, members: [staff.nurse, staff.doctor, staff.dataManager], messages: ['Séance avancée prévue jeudi à Nkolbisson.', 'Pensez aux caisses isothermes, la CAISSE-01 est en réparation.', 'Noté, je prends le porte-vaccins.'] },
      { title: null, isGroup: false, members: [staff.pharmacist, staff.dataManager], messages: ['Rapport de stock de septembre prêt pour le RMA3.', 'Parfait, je valide le formulaire mensuel aujourd’hui.'] },
    ];
    for (const [t, th] of threads.entries()) {
      const createdAt = daysAgo(5 - t, 8, 0);
      const conversation = await prisma.conversation.create({ data: { tenantId, title: th.title, isGroup: th.isGroup, createdBy: th.members[0].id, lastMessageAt: createdAt } });
      for (const m of th.members) await prisma.conversationParticipant.create({ data: { conversationId: conversation.id, userId: m.id, lastReadAt: m === th.members[0] ? createdAt : null } });
      for (const [i, body] of th.messages.entries()) {
        const at = new Date(createdAt.getTime() + i * 10 * 60_000);
        await prisma.message.create({ data: { conversationId: conversation.id, senderId: th.members[i % th.members.length].id, body, createdAt: at } });
        await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: at } });
      }
    }
  }
  console.log('  Planning and messaging ready.');
}

// Demo prices for the exams the reference catalog leaves unpriced (a tariff is the facility's
// decision, so the reference seed sets none): the same amounts the journeys bill. Only fills
// missing prices, and keeps the fee schedule — what billing reads — in sync.
async function seedDemoExamPrices(ctx: ProgramCtx) {
  const entries = await prisma.examCatalogEntry.findMany({ where: { tenantId: ctx.tenantId, price: null }, select: { id: true, code: true, nameFr: true, isActive: true, examType: { select: { domain: true } } } });
  for (const e of entries) {
    const price = e.examType.domain === 'radiology' ? 35000 : 8000;
    await prisma.examCatalogEntry.update({ where: { id: e.id }, data: { price } });
    await syncExamFeeSchedule({ tenantId: ctx.tenantId, code: e.code, label: e.nameFr, price, isActive: e.isActive });
  }
  console.log(`  Exam prices: ${entries.length} unpriced exams given a demo price.`);
}

export async function seedPrograms(ctx: ProgramCtx) {
  console.log(`Seeding programme and RMA3 module data for ${ctx.patients.length} new patients...`);
  await seedDemoExamPrices(ctx);
  const articles = await seedRma3Articles(ctx);
  await seedDiagnoses(ctx, articles);
  await seedEpi(ctx);
  await seedMotherChild(ctx);
  await seedHiv(ctx);
  await seedMalariaTbComplements(ctx);
  await seedNutrition(ctx);
  await seedOxygen(ctx);
  await seedBloodBank(ctx);
  await seedStaffRegister(ctx);
  await seedChronicCare(ctx);
  await seedCivilAndPharmacovigilance(ctx, articles);
  await seedRma3(ctx);
  await seedPlanningAndMessaging(ctx);
  await seedCoverage(ctx);
}
