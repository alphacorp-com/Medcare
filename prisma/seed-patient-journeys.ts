// Seeds 50 patients with genuinely different, fully-digitized care journeys —
// appointments, emergency/scheduled admissions, surgery, radiology, lab
// workups, maternity, disease programs (malaria/TB/immunization), pharmacy,
// and billing — each exercised across every status value it has, so the app
// has real, varied data to browse instead of empty screens.
//
// Targets the ONE real tenant an on-prem install actually has (created via
// /setup) — this is not a demo-tenant script. Creates its own baseline
// (departments, beds, medications, clinical staff with real Roles) since a
// fresh install has none of that yet; safe to re-run (skips entirely if
// patients with the PJ- IPP prefix already exist).
//
// Note: some of these journeys (surgery, radiology) use modules that may not
// be included in this install's current AlphaCorp license yet — the data is
// seeded regardless, since applying an updated license later will make it
// visible immediately (see lib/tenant-licensing.ts's syncTenantModulesFromLicense).
// Also seeds more staff/beds than the current license's maxUsers/maxBeds may
// allow — fine for a direct DB seed, just something to reconcile once the
// license is updated.
import 'dotenv/config';
import {
  Gender,
  StayType,
  StayStatus,
  TriageAcuity,
  ConsultationStatus,
  AppointmentStatus,
  MedicalRecordType,
  PrescriptionStatus,
  ExamType,
  ExamUrgency,
  ExamRequestStatus,
  SurgicalStatus,
  DispensingStatus,
  BillingSourceType,
  BillingInvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  AdverseEventType,
  AdverseEventSeverity,
  AdverseEventStatus,
  PregnancyStatus,
  DeliveryMode,
  MalariaTestType,
  MalariaResult,
  MalariaSeverity,
  TbCaseType,
  TbClassification,
  TbHivStatus,
  TbTreatmentOutcome,
  TbSputumResult,
  TbControlPoint,
  DepartmentType,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma';

const IPP_PREFIX = 'PJ';
const STAY_PREFIX = 'STPJ';
const STAFF_PASSWORD = 'Demo1234!';

function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function daysFromNow(n: number, hour = 9, minute = 0): Date {
  return daysAgo(-n, hour, minute);
}
function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

let stayCounter = 0;
function nextStayNumber(): string {
  stayCounter += 1;
  return `${STAY_PREFIX}${String(stayCounter).padStart(4, '0')}`;
}

async function recalcInvoice(invoiceId: string) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const totals = await prisma.patientInvoiceLine.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const subtotal = Number(totals._sum.amount ?? 0);
  const patientAmount = subtotal - Number(invoice.insuranceAmount);
  const paidAmount = Number(invoice.paidAmount);
  const status: BillingInvoiceStatus =
    paidAmount <= 0
      ? BillingInvoiceStatus.pending_payment
      : paidAmount >= patientAmount && patientAmount > 0
        ? BillingInvoiceStatus.paid
        : BillingInvoiceStatus.partially_paid;
  return prisma.patientInvoice.update({ where: { id: invoiceId }, data: { subtotal, patientAmount, status } });
}

async function recalcInvoicePaid(invoiceId: string, paidAmount: number) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const status: BillingInvoiceStatus =
    paidAmount <= 0
      ? BillingInvoiceStatus.pending_payment
      : paidAmount >= Number(invoice.patientAmount)
        ? BillingInvoiceStatus.paid
        : BillingInvoiceStatus.partially_paid;
  return prisma.patientInvoice.update({ where: { id: invoiceId }, data: { paidAmount, status } });
}

// ─────────────────────────────────────────────────────────────────────────
// Baseline: departments, beds, medications, staff — a fresh install has none
// of this yet (seed.ts only seeds the module catalog; reference data is a
// separate `npm run seed-settings`).
// ─────────────────────────────────────────────────────────────────────────

async function ensureDepartments(tenantId: string) {
  const defs: { code: string; name: string; type: DepartmentType }[] = [
    { code: 'ADM', name: 'Administration', type: DepartmentType.admin },
    { code: 'EMER', name: 'Urgences', type: DepartmentType.emergency },
    { code: 'SURG', name: 'Chirurgie', type: DepartmentType.surgery },
    { code: 'MED', name: 'Médecine Générale', type: DepartmentType.medicine },
    { code: 'LAB', name: 'Laboratoire', type: DepartmentType.laboratory },
    { code: 'RAD', name: 'Radiologie', type: DepartmentType.radiology },
    { code: 'PHAR', name: 'Pharmacie', type: DepartmentType.pharmacy },
    { code: 'MAT', name: 'Maternité', type: DepartmentType.maternity },
  ];
  const byCode: Record<string, { id: string }> = {};
  for (const d of defs) {
    const dept = await prisma.department.upsert({
      where: { tenantId_code: { tenantId, code: d.code } },
      update: { name: d.name, type: d.type },
      create: { tenantId, code: d.code, name: d.name, type: d.type },
    });
    byCode[d.code] = dept;
  }
  console.log(`Departments ensured (${defs.length}).`);
  return byCode;
}

async function ensureBeds(tenantId: string, departments: Record<string, { id: string }>) {
  const roomTypes = Object.fromEntries(
    (await prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: 'room_type' } })).map((r) => [r.code, r.id])
  );
  const defs: { code: string; label: string; deptCode: string; roomTypeCode?: string }[] = [
    { code: 'EMER-01', label: 'Urgences - Box 1', deptCode: 'EMER', roomTypeCode: 'EMERGENCY' },
    { code: 'EMER-02', label: 'Urgences - Box 2', deptCode: 'EMER', roomTypeCode: 'EMERGENCY' },
    { code: 'EMER-03', label: 'Urgences - Box 3', deptCode: 'EMER', roomTypeCode: 'EMERGENCY' },
    { code: 'EMER-04', label: 'Urgences - Box 4 (réa)', deptCode: 'EMER', roomTypeCode: 'ICU' },
    { code: 'SURG-01', label: 'Bloc opératoire 1', deptCode: 'SURG', roomTypeCode: 'SURGICAL' },
    { code: 'SURG-02', label: 'Bloc opératoire 2', deptCode: 'SURG', roomTypeCode: 'SURGICAL' },
    { code: 'MED-01', label: 'Médecine - Lit 1', deptCode: 'MED', roomTypeCode: 'GENERAL' },
    { code: 'MED-02', label: 'Médecine - Lit 2', deptCode: 'MED', roomTypeCode: 'GENERAL' },
    { code: 'MED-03', label: 'Médecine - Lit 3', deptCode: 'MED', roomTypeCode: 'GENERAL' },
    { code: 'MED-04', label: 'Médecine - Lit 4', deptCode: 'MED', roomTypeCode: 'GENERAL' },
    { code: 'MAT-01', label: 'Maternité - Lit 1', deptCode: 'MAT', roomTypeCode: 'MATERNITY' },
    { code: 'MAT-02', label: 'Maternité - Lit 2', deptCode: 'MAT', roomTypeCode: 'MATERNITY' },
  ];
  const byCode: Record<string, { id: string }> = {};
  for (const b of defs) {
    const bed = await prisma.bed.upsert({
      where: { tenantId_code: { tenantId, code: b.code } },
      update: {},
      create: {
        tenantId,
        code: b.code,
        label: b.label,
        departmentId: departments[b.deptCode].id,
        roomTypeId: b.roomTypeCode ? roomTypes[b.roomTypeCode] ?? null : null,
      },
    });
    byCode[b.code] = bed;
  }
  console.log(`Beds ensured (${defs.length}).`);
  return byCode;
}

async function ensureMedications(tenantId: string) {
  const defs = [
    { name: 'Paracetamol 500mg Tablets', category: 'Analgesic', stock: 1500, threshold: 200, unit: 'tablets', unitPrice: 100 },
    { name: 'Ibuprofen 200mg Tablets', category: 'Anti-inflammatory', stock: 1200, threshold: 150, unit: 'tablets', unitPrice: 80 },
    { name: 'Amoxicillin 500mg Capsules', category: 'Antibiotic', stock: 800, threshold: 100, unit: 'capsules', unitPrice: 150 },
    { name: 'Metformin 500mg Tablets', category: 'Antidiabetic', stock: 900, threshold: 120, unit: 'tablets', unitPrice: 100 },
    { name: 'Amlodipine 5mg Tablets', category: 'Cardiovascular', stock: 700, threshold: 90, unit: 'tablets', unitPrice: 120 },
    { name: 'Artemether-Lumefantrine (Coartem) 20/120mg Tablets', category: 'Antimalarial', stock: 600, threshold: 100, unit: 'tablets', unitPrice: 350 },
    { name: 'Artesunate Injectable 60mg', category: 'Antimalarial', stock: 200, threshold: 40, unit: 'ampoules', unitPrice: 1500 },
    { name: 'Rifampicine+INH+Pyrazinamide+Ethambutol (RHZE) Tablets', category: 'Anti-tuberculosis', stock: 250, threshold: 40, unit: 'tablets', unitPrice: 400 },
    { name: 'Oseltamivir 75mg Capsules', category: 'Antiviral', stock: 30, threshold: 20, unit: 'capsules', unitPrice: 1000 },
    { name: 'Ciprofloxacin 500mg Tablets', category: 'Antibiotic', stock: 750, threshold: 100, unit: 'tablets', unitPrice: 200 },
  ];
  const byName: Record<string, { id: string; name: string; unit: string | null; unitPrice: Prisma.Decimal | null }> = {};
  for (const m of defs) {
    let med = await prisma.medicationInventory.findFirst({ where: { tenantId, name: m.name } });
    if (!med) {
      med = await prisma.medicationInventory.create({ data: { tenantId, manufacturer: 'Generic', ...m } });
    }
    byName[m.name] = med;
  }
  console.log(`Medications ensured (${defs.length}).`);
  return byName;
}

async function ensureRole(
  tenantId: string,
  name: string,
  opts: { isClinicalProvider?: boolean; defaultModules?: { moduleId: string; actions: string[] }[] } = {}
) {
  const existing = await prisma.role.findFirst({ where: { tenantId, name } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      tenantId,
      name,
      isSystemAdmin: false,
      isClinicalProvider: opts.isClinicalProvider ?? false,
      defaultModules: (opts.defaultModules ?? []) as unknown as Prisma.InputJsonValue,
    },
  });
}

async function ensureStaff(tenantId: string, departments: Record<string, { id: string }>) {
  const passwordHash = await bcrypt.hash(STAFF_PASSWORD, 10);

  const doctorRole = await ensureRole(tenantId, 'Médecin', {
    isClinicalProvider: true,
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_ADMISSION', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_LAB', actions: ['read', 'create'] },
      { moduleId: 'MODULE_SURGERY', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_RADIOLOGY', actions: ['read', 'create'] },
      { moduleId: 'MODULE_PHARMACY', actions: ['read', 'create'] },
      { moduleId: 'MODULE_APPOINTMENTS', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_MATERNITY', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_DISEASE_PROGRAMS', actions: ['read', 'create', 'update'] },
    ],
  });
  const nurseRole = await ensureRole(tenantId, 'Infirmier', {
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_ADMISSION', actions: ['read', 'create', 'update'] },
      { moduleId: 'MODULE_PHARMACY', actions: ['read'] },
      { moduleId: 'MODULE_MATERNITY', actions: ['read', 'create'] },
    ],
  });
  const pharmacistRole = await ensureRole(tenantId, 'Pharmacien', {
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read'] },
      { moduleId: 'MODULE_PHARMACY', actions: ['read', 'create', 'update', 'delete'] },
    ],
  });
  const labTechRole = await ensureRole(tenantId, 'Laborantin', {
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read'] },
      { moduleId: 'MODULE_LAB', actions: ['read', 'create', 'update'] },
    ],
  });
  const radiologistRole = await ensureRole(tenantId, 'Radiologue', {
    isClinicalProvider: true,
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read'] },
      { moduleId: 'MODULE_RADIOLOGY', actions: ['read', 'create', 'update', 'delete'] },
    ],
  });
  const billingRole = await ensureRole(tenantId, 'Facturation', {
    defaultModules: [
      { moduleId: 'MODULE_CORE_PATIENT', actions: ['read'] },
      { moduleId: 'MODULE_BILLING', actions: ['read', 'create', 'update'] },
    ],
  });

  async function ensureUser(email: string, fullName: string, roleId: string, deptCode: string) {
    const existing = await prisma.tenantUser.findUnique({ where: { email } });
    if (existing) return existing;
    return prisma.tenantUser.create({
      data: {
        tenantId,
        email,
        fullName,
        roleId,
        passwordHash,
        isActive: true,
        departmentId: departments[deptCode]?.id,
        modules: [],
      },
    });
  }

  const doctor = await ensureUser('dr.mendo@hospital.test', 'Dr. Paul Mendo', doctorRole.id, 'MED');
  const doctor2 = await ensureUser('dr.abena@hospital.test', 'Dr. Sylvie Abena', doctorRole.id, 'SURG');
  const nurse = await ensureUser('nurse.kamga@hospital.test', 'Brigitte Kamga', nurseRole.id, 'EMER');
  const pharmacist = await ensureUser('pharmacy.tchinda@hospital.test', 'Éric Tchinda', pharmacistRole.id, 'PHAR');
  const labTech = await ensureUser('lab.ngo@hospital.test', 'Sandrine Ngo', labTechRole.id, 'LAB');
  const radiologist = await ensureUser('radio.foka@hospital.test', 'Dr. Alain Foka', radiologistRole.id, 'RAD');
  const billingUser = await ensureUser('billing.essomba@hospital.test', 'Christelle Essomba', billingRole.id, 'ADM');

  for (const doc of [doctor, doctor2]) {
    for (let weekday = 1; weekday <= 5; weekday++) {
      await prisma.doctorAvailability.upsert({
        where: { tenantId_doctorId_weekday: { tenantId, doctorId: doc.id, weekday } },
        update: {},
        create: { tenantId, doctorId: doc.id, weekday, startTime: '08:00', endTime: '16:00', slotMinutes: 20 },
      });
    }
  }

  console.log(`Staff ensured (2 doctors, nurse, pharmacist, lab tech, radiologist, billing — password "${STAFF_PASSWORD}").`);
  return { doctor, doctor2, nurse, pharmacist, labTech, radiologist, billingUser };
}

// ─────────────────────────────────────────────────────────────────────────
// Patients — 50 identities, each tagged with the journey to build for them.
// ─────────────────────────────────────────────────────────────────────────

type Journey =
  | 'registered' | 'apptUpcoming' | 'apptNoShow' | 'apptCancelled'
  | 'outpatientPaid' | 'emergencyMinor' | 'emergencyCritical' | 'chronicFollowUp'
  | 'dayCare' | 'preAdmission' | 'transferred' | 'deceased'
  | 'surgeryScheduledEmpty' | 'surgeryScheduledReady' | 'surgeryInProgress'
  | 'surgeryCompleted' | 'surgeryCancelled' | 'surgeryPostponed'
  | 'radiologyWorkup' | 'labWorkup'
  | 'maternityOngoing' | 'maternityDelivered'
  | 'malariaSimple' | 'malariaSevere' | 'tbCase' | 'immunizationChild'
  | 'pharmacyPending' | 'pharmacyValidated' | 'pharmacyDispensed' | 'pharmacyCancelled' | 'pharmacyExpired'
  | 'billingDraft' | 'billingPendingMobileMoney' | 'billingPartiallyPaid' | 'billingCancelled' | 'billingFailedPayment';

interface PatientSeed {
  lastName: string; firstName: string; birthDate: Date; gender: Gender;
  phone?: string; bloodGroup?: string; allergies?: string[]; chronicConditions?: string[];
  journey: Journey;
}

const PATIENTS: PatientSeed[] = [
  { lastName: 'Mbarga', firstName: 'Jean', birthDate: yearsAgo(34), gender: Gender.M, phone: '+237 677100001', bloodGroup: 'O+', allergies: ['Pénicilline'], journey: 'emergencyCritical' },
  { lastName: 'Talla', firstName: 'Marie', birthDate: yearsAgo(45), gender: Gender.F, phone: '+237 677100002', bloodGroup: 'A+', journey: 'emergencyMinor' },
  { lastName: 'Nkeng', firstName: 'Paul', birthDate: yearsAgo(58), gender: Gender.M, phone: '+237 677100003', chronicConditions: ['Hypertension artérielle'], journey: 'chronicFollowUp' },
  { lastName: 'Etoundi', firstName: 'Sarah', birthDate: yearsAgo(29), gender: Gender.F, phone: '+237 677100004', journey: 'labWorkup' },
  { lastName: 'Fouda', firstName: 'Robert', birthDate: yearsAgo(67), gender: Gender.M, phone: '+237 677100005', chronicConditions: ['Diabète type 2', 'Insuffisance rénale'], journey: 'radiologyWorkup' },
  { lastName: 'Biya', firstName: 'Alphonse', birthDate: yearsAgo(72), gender: Gender.M, phone: '+237 677100006', journey: 'deceased' },
  { lastName: 'Njoya', firstName: 'Aminatou', birthDate: yearsAgo(31), gender: Gender.F, phone: '+237 677100007', journey: 'maternityOngoing' },
  { lastName: 'Belinga', firstName: 'Grace', birthDate: yearsAgo(26), gender: Gender.F, phone: '+237 677100008', journey: 'maternityDelivered' },
  { lastName: 'Tchoua', firstName: 'Emmanuel', birthDate: daysAgo(220), gender: Gender.M, journey: 'immunizationChild' },
  { lastName: 'Oumarou', firstName: 'Fatima', birthDate: yearsAgo(40), gender: Gender.F, phone: '+237 677100010', journey: 'tbCase' },
  { lastName: 'Ateba', firstName: 'Chantal', birthDate: yearsAgo(52), gender: Gender.F, phone: '+237 677100011', journey: 'outpatientPaid' },
  { lastName: 'Mballa', firstName: 'David', birthDate: yearsAgo(50), gender: Gender.M, phone: '+237 677100012', journey: 'apptUpcoming' },
  { lastName: 'Onana', firstName: 'Sylvie', birthDate: yearsAgo(38), gender: Gender.F, phone: '+237 677100013', journey: 'apptNoShow' },
  { lastName: 'Kamdem', firstName: 'Bertrand', birthDate: yearsAgo(44), gender: Gender.M, phone: '+237 677100014', journey: 'apptCancelled' },
  { lastName: 'Ngo Bell', firstName: 'Odile', birthDate: yearsAgo(61), gender: Gender.F, phone: '+237 677100015', chronicConditions: ['Asthme'], journey: 'dayCare' },
  { lastName: 'Essola', firstName: 'Martin', birthDate: yearsAgo(55), gender: Gender.M, phone: '+237 677100016', journey: 'preAdmission' },
  { lastName: 'Zang', firstName: 'Christiane', birthDate: yearsAgo(48), gender: Gender.F, phone: '+237 677100017', journey: 'transferred' },
  { lastName: 'Abega', firstName: 'Joseph', birthDate: yearsAgo(63), gender: Gender.M, phone: '+237 677100018', journey: 'surgeryScheduledEmpty' },
  { lastName: 'Mvondo', firstName: 'Alice', birthDate: yearsAgo(37), gender: Gender.F, phone: '+237 677100019', journey: 'surgeryScheduledReady' },
  { lastName: 'Nana', firstName: 'Innocent', birthDate: yearsAgo(41), gender: Gender.M, phone: '+237 677100020', journey: 'surgeryInProgress' },
  { lastName: 'Fotso', firstName: 'Bernadette', birthDate: yearsAgo(28), gender: Gender.F, phone: '+237 677100021', journey: 'surgeryCompleted' },
  { lastName: 'Wandji', firstName: 'Serge', birthDate: yearsAgo(35), gender: Gender.M, phone: '+237 677100022', journey: 'surgeryCancelled' },
  { lastName: 'Tsafack', firstName: 'Pauline', birthDate: yearsAgo(59), gender: Gender.F, phone: '+237 677100023', journey: 'surgeryPostponed' },
  { lastName: 'Djoumessi', firstName: 'Hervé', birthDate: yearsAgo(46), gender: Gender.M, phone: '+237 677100024', journey: 'malariaSimple' },
  { lastName: 'Nguemo', firstName: 'Blandine', birthDate: yearsAgo(24), gender: Gender.F, phone: '+237 677100025', journey: 'malariaSevere' },
  { lastName: 'Simo', firstName: 'Patrice', birthDate: yearsAgo(33), gender: Gender.M, phone: '+237 677100026', journey: 'pharmacyPending' },
  { lastName: 'Kenfack', firstName: 'Solange', birthDate: yearsAgo(49), gender: Gender.F, phone: '+237 677100027', journey: 'pharmacyValidated' },
  { lastName: 'Youmbi', firstName: 'Cédric', birthDate: yearsAgo(30), gender: Gender.M, phone: '+237 677100028', journey: 'pharmacyDispensed' },
  { lastName: 'Feudjio', firstName: 'Nadège', birthDate: yearsAgo(27), gender: Gender.F, phone: '+237 677100029', journey: 'pharmacyCancelled' },
  { lastName: 'Tamo', firstName: 'Gilbert', birthDate: yearsAgo(66), gender: Gender.M, phone: '+237 677100030', journey: 'pharmacyExpired' },
  { lastName: 'Nzepa', firstName: 'Rosine', birthDate: yearsAgo(43), gender: Gender.F, phone: '+237 677100031', journey: 'billingDraft' },
  { lastName: 'Kuate', firstName: 'Michel', birthDate: yearsAgo(54), gender: Gender.M, phone: '+237 677100032', journey: 'billingPendingMobileMoney' },
  { lastName: 'Mekongo', firstName: 'Justine', birthDate: yearsAgo(36), gender: Gender.F, phone: '+237 677100033', journey: 'billingPartiallyPaid' },
  { lastName: 'Owona', firstName: 'Frédéric', birthDate: yearsAgo(39), gender: Gender.M, phone: '+237 677100034', journey: 'billingCancelled' },
  { lastName: 'Assiga', firstName: 'Carine', birthDate: yearsAgo(32), gender: Gender.F, phone: '+237 677100035', journey: 'billingFailedPayment' },
  { lastName: 'Mengue', firstName: 'Rodrigue', birthDate: yearsAgo(60), gender: Gender.M, phone: '+237 677100036', chronicConditions: ['Hypertension artérielle', 'Diabète type 2'], journey: 'chronicFollowUp' },
  { lastName: 'Bikoro', firstName: 'Yvette', birthDate: yearsAgo(22), gender: Gender.F, phone: '+237 677100037', journey: 'outpatientPaid' },
  { lastName: 'Ekwalla', firstName: 'Samuel', birthDate: yearsAgo(56), gender: Gender.M, phone: '+237 677100038', journey: 'emergencyMinor' },
  { lastName: 'Manga', firstName: 'Josiane', birthDate: yearsAgo(19), gender: Gender.F, phone: '+237 677100039', journey: 'emergencyMinor' },
  { lastName: 'Eyenga', firstName: 'Thierry', birthDate: yearsAgo(47), gender: Gender.M, phone: '+237 677100040', journey: 'radiologyWorkup' },
  { lastName: 'Ondoa', firstName: 'Delphine', birthDate: yearsAgo(64), gender: Gender.F, phone: '+237 677100041', journey: 'radiologyWorkup' },
  { lastName: 'Bindzi', firstName: 'Aurélien', birthDate: yearsAgo(25), gender: Gender.M, phone: '+237 677100042', journey: 'labWorkup' },
  { lastName: 'Mballa Eyenga', firstName: 'Nathalie', birthDate: yearsAgo(53), gender: Gender.F, phone: '+237 677100043', journey: 'labWorkup' },
  { lastName: 'Nkodo', firstName: 'Vincent', birthDate: yearsAgo(70), gender: Gender.M, phone: '+237 677100044', chronicConditions: ['BPCO'], journey: 'dayCare' },
  { lastName: 'Amougou', firstName: 'Léa', birthDate: daysAgo(60), gender: Gender.F, journey: 'immunizationChild' },
  { lastName: 'Ella', firstName: 'Constant', birthDate: yearsAgo(42), gender: Gender.M, phone: '+237 677100046', journey: 'tbCase' },
  { lastName: 'Nyangono', firstName: 'Béatrice', birthDate: yearsAgo(35), gender: Gender.F, phone: '+237 677100047', journey: 'maternityOngoing' },
  { lastName: 'Same', firstName: 'Achille', birthDate: yearsAgo(20), gender: Gender.M, journey: 'apptUpcoming' },
  { lastName: 'Minko', firstName: 'Georgette', birthDate: yearsAgo(75), gender: Gender.F, phone: '+237 677100049', journey: 'registered' },
  { lastName: 'Batchou', firstName: 'Léon', birthDate: yearsAgo(5), gender: Gender.M, journey: 'registered' },
];

// ─────────────────────────────────────────────────────────────────────────
// Shared context passed to every journey builder.
// ─────────────────────────────────────────────────────────────────────────

interface Ctx {
  tenantId: string;
  departments: Record<string, { id: string }>;
  beds: Record<string, { id: string }>;
  medications: Record<string, { id: string; name: string; unit: string | null; unitPrice: Prisma.Decimal | null }>;
  staff: Awaited<ReturnType<typeof ensureStaff>>;
  admissionTypes: Record<string, string>;
  examCatalog: Record<string, { code: string; nameFr: string }>;
  medicalActs: Record<string, { code: string; nameFr: string; basePrice: Prisma.Decimal }>;
}

async function loadCatalogRefs(tenantId: string): Promise<Pick<Ctx, 'admissionTypes' | 'examCatalog' | 'medicalActs'>> {
  const admissionTypes = Object.fromEntries(
    (await prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: 'admission_type' } })).map((i) => [i.code, i.id])
  );
  const examEntries = await prisma.examCatalogEntry.findMany({ where: { tenantId } });
  const examCatalog = Object.fromEntries(examEntries.map((e) => [e.code, e]));
  const acts = await prisma.medicalAct.findMany({ where: { tenantId } });
  const medicalActs = Object.fromEntries(acts.map((a) => [a.code, a]));
  return { admissionTypes, examCatalog, medicalActs };
}

async function makeConsultationInvoice(ctx: Ctx, patientId: string, stayId: string, actCode: string) {
  const act = ctx.medicalActs[actCode];
  const invoice = await prisma.patientInvoice.create({
    data: { tenantId: ctx.tenantId, patientId, stayId, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: {
      tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.consultation, sourceId: stayId,
      description: act.nameFr, quantity: 1, unitPrice: Number(act.basePrice), amount: Number(act.basePrice),
    },
  });
  return recalcInvoice(invoice.id);
}

// ─────────────────────────────────────────────────────────────────────────
// Journey builders — each creates a coherent, realistic slice of the app's
// data for one patient. Parameterized so the same builder produces visibly
// different records (dates, staff, amounts) across repeated uses.
// ─────────────────────────────────────────────────────────────────────────

async function journeyRegistered(_ctx: Ctx) {
  // Nothing beyond the Patient row itself — a freshly registered patient who
  // hasn't had a visit yet. Realistic empty state, not a bug.
}

async function journeyAppointment(
  ctx: Ctx, patientId: string, status: AppointmentStatus, when: Date, reason: string, doctorId: string
) {
  const dept = ctx.departments['MED'];
  const data: Prisma.AppointmentUncheckedCreateInput = {
    tenantId: ctx.tenantId, patientId, doctorId, departmentId: dept.id,
    appointmentTypeCode: 'CONSULTATION', scheduledAt: when, status, reasonForVisit: reason,
    createdBy: ctx.staff.doctor.id,
  };
  if (status === AppointmentStatus.cancelled) {
    data.cancelledAt = new Date(when.getTime() - 86400000);
    data.cancelledReason = 'Empêchement du patient';
  }
  await prisma.appointment.create({ data });
}

async function journeyOutpatientPaid(ctx: Ctx, patientId: string, offsetDays: number, reason: string) {
  const dept = ctx.departments['MED'];
  const appt = await prisma.appointment.create({
    data: {
      tenantId: ctx.tenantId, patientId, doctorId: ctx.staff.doctor.id, departmentId: dept.id,
      appointmentTypeCode: 'CONSULTATION', scheduledAt: daysAgo(offsetDays, 9, 0), status: AppointmentStatus.booked,
      reasonForVisit: reason, createdBy: ctx.staff.doctor.id,
    },
  });
  const stay = await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.outpatient, status: StayStatus.discharged,
      admissionDate: daysAgo(offsetDays, 9, 5), dischargeDate: daysAgo(offsetDays, 9, 40), departmentId: dept.id,
      attendingDoctorId: ctx.staff.doctor.id, admissionReason: reason, admissionTypeId: ctx.admissionTypes['WALK_IN'],
      consultationStatus: ConsultationStatus.completed,
      dischargeSummary: 'Consultation réalisée sans complication. Retour à domicile.',
    },
  });
  await prisma.appointment.update({ where: { id: appt.id }, data: { status: AppointmentStatus.checked_in, stayId: stay.id } });
  await prisma.medicalRecord.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, authorId: ctx.staff.doctor.id, type: MedicalRecordType.observation,
      title: 'Consultation', content: `${reason}. Examen clinique sans anomalie notable. Conseils prodigués.`,
    },
  });
  const invoice = await makeConsultationInvoice(ctx, patientId, stay.id, 'CONS_GEN');
  const amount = invoice.patientAmount.toNumber();
  await prisma.payment.create({
    data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount, method: PaymentMethod.cash, status: PaymentStatus.successful, currency: 'XAF', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(offsetDays, 9, 40), completedAt: daysAgo(offsetDays, 9, 40) },
  });
  await recalcInvoicePaid(invoice.id, amount);
}

const TRIAGE_REASONS: Record<string, string> = {
  suture: 'Plaie superficielle nécessitant une suture',
  entorse: 'Entorse de cheville',
  fievre: 'Fièvre modérée persistante',
};

async function journeyEmergencyMinor(ctx: Ctx, patientId: string, bedCode: string, reasonKey: keyof typeof TRIAGE_REASONS) {
  const dept = ctx.departments['EMER'];
  const bed = ctx.beds[bedCode];
  const stay = await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.discharged,
      admissionDate: daysAgo(2, 10, 0), dischargeDate: daysAgo(2, 13, 0), departmentId: dept.id, bedId: bed.id,
      attendingDoctorId: ctx.staff.doctor.id, admissionReason: TRIAGE_REASONS[reasonKey],
      admissionTypeId: ctx.admissionTypes['EMERGENCY'], triageAcuity: TriageAcuity.less_urgent, triagedAt: daysAgo(2, 10, 5),
      consultationStatus: ConsultationStatus.completed, dischargeSummary: 'Prise en charge simple, sortie avec consignes.',
    },
  });
  await prisma.vitalSigns.create({
    data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, recordedById: ctx.staff.nurse.id, recordedAt: daysAgo(2, 10, 10), bloodPressureSystolic: 122, bloodPressureDiastolic: 78, pulse: 84, temperature: 37.4, spo2: 98 },
  });
  const invoice = await makeConsultationInvoice(ctx, patientId, stay.id, 'CONS_GEN_URG');
  await recalcInvoicePaid(invoice.id, invoice.patientAmount.toNumber());
}

async function journeyEmergencyCritical(ctx: Ctx, patientId: string) {
  const dept = ctx.departments['EMER'];
  const bed = ctx.beds['EMER-04'];
  const stay = await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.in_progress,
      admissionDate: daysAgo(0, 6, 30), departmentId: dept.id, bedId: bed.id, attendingDoctorId: ctx.staff.doctor.id,
      admissionReason: 'Polytraumatisme — accident de la route', admissionTypeId: ctx.admissionTypes['EMERGENCY'],
      triageAcuity: TriageAcuity.resuscitation, triagedAt: daysAgo(0, 6, 32), consultationStatus: ConsultationStatus.claimed,
    },
  });
  await prisma.bed.update({ where: { id: bed.id }, data: { status: 'occupied', currentStayId: stay.id } });
  await prisma.vitalSigns.create({
    data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, recordedById: ctx.staff.nurse.id, recordedAt: daysAgo(0, 6, 35), bloodPressureSystolic: 82, bloodPressureDiastolic: 50, pulse: 128, temperature: 35.8, spo2: 89 },
  });
  const troponin = ctx.examCatalog['TROP-I'];
  const examRequest = await prisma.examRequest.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, prescriberId: ctx.staff.doctor.id, type: ExamType.biology,
      examCode: troponin.code, examLabel: troponin.nameFr, urgency: ExamUrgency.stat, status: ExamRequestStatus.completed,
      requestedAt: daysAgo(0, 6, 40), scheduledAt: daysAgo(0, 6, 45), completedAt: daysAgo(0, 7, 0),
    },
  });
  const result = await prisma.examResult.create({
    data: {
      tenantId: ctx.tenantId, requestId: examRequest.id, patientId, performerId: ctx.staff.labTech.id,
      resultData: { parameters: [{ name: 'Troponin I', value: '2.4', unit: 'ng/mL', referenceRange: '< 0.04', flag: 'critical' }] } as unknown as Prisma.InputJsonValue,
      isCritical: true, criticalNotifiedAt: daysAgo(0, 7, 1), validatedAt: daysAgo(0, 7, 1), validatedBy: ctx.staff.labTech.id,
    },
  });
  await prisma.notification.create({
    data: {
      tenantId: ctx.tenantId, recipientId: ctx.staff.doctor.id, type: 'module_event', moduleId: 'MODULE_LAB',
      title: 'Résultat critique', body: 'Troponine I à 2,4 ng/mL (seuil critique).',
      resourceType: 'exam_result', resourceId: result.id, actorId: ctx.staff.labTech.id, link: `/patients/${patientId}`,
    },
  });

  const surgery = await prisma.surgicalProcedure.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, surgeonId: ctx.staff.doctor2.id, roomId: ctx.beds['SURG-01']?.id,
      procedureLabel: 'Laparotomie exploratrice — traumatisme abdominal', status: SurgicalStatus.completed,
      scheduledAt: daysAgo(0, 8, 0), startedAt: daysAgo(0, 8, 15), endedAt: daysAgo(0, 10, 30), asaScore: 4,
      surgicalReport: 'Hémopéritoine drainé, plaie splénique suturée. Patient stabilisé.',
      whoChecklist: {
        signIn: { items: { patientIdentityConfirmed: true, siteMarked: true, anesthesiaSafetyCheck: true }, completedAt: daysAgo(0, 8, 0).toISOString(), completedBy: ctx.staff.nurse.id },
        timeOut: { items: { teamIntroduced: true, criticalStepsReviewed: true }, completedAt: daysAgo(0, 8, 12).toISOString(), completedBy: ctx.staff.doctor2.id },
        signOut: { items: { instrumentCountCorrect: true, specimenLabeled: true }, completedAt: daysAgo(0, 10, 25).toISOString(), completedBy: ctx.staff.nurse.id },
      } as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.medicalRecord.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, authorId: ctx.staff.doctor2.id, type: MedicalRecordType.surgery_report,
      title: 'Compte-rendu opératoire', content: 'Laparotomie exploratrice pour traumatisme abdominal. Plaie splénique suturée.',
      isSigned: true, signedAt: daysAgo(0, 10, 35), signedBy: ctx.staff.doctor2.id,
      signatureHash: crypto.createHash('sha256').update(surgery.id).digest('hex'),
    },
  });

  const invoice = await prisma.patientInvoice.create({
    data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.exam, sourceId: examRequest.id, description: troponin.nameFr, quantity: 1, unitPrice: 15000, amount: 15000 } });
  await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.surgery, sourceId: surgery.id, description: 'Laparotomie exploratrice', quantity: 1, unitPrice: 250000, amount: 250000 } });
  const recalced = await recalcInvoice(invoice.id);
  await prisma.payment.create({
    data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: recalced.patientAmount, method: PaymentMethod.insurance, status: PaymentStatus.successful, currency: 'XAF', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(0, 11, 0), completedAt: daysAgo(0, 11, 5) },
  });
  await recalcInvoicePaid(invoice.id, recalced.patientAmount.toNumber());

  await prisma.adverseEvent.create({
    data: { tenantId: ctx.tenantId, declaredBy: ctx.staff.doctor2.id, patientId, stayId: stay.id, type: AdverseEventType.procedure_complication, severity: AdverseEventSeverity.major, description: 'Saignement post-opératoire ayant nécessité une surveillance rapprochée.', status: AdverseEventStatus.action_plan, immediateAction: 'Transfusion et surveillance hémodynamique renforcée.' },
  });
}

async function journeyChronicFollowUp(ctx: Ctx, patientId: string, bedCode: string, condition: string) {
  const dept = ctx.departments['MED'];
  const bed = ctx.beds[bedCode];
  const stay = await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.scheduled, status: StayStatus.in_progress,
      admissionDate: daysAgo(1, 8, 0), departmentId: dept.id, bedId: bed.id, attendingDoctorId: ctx.staff.doctor.id,
      admissionReason: `Bilan programmé — ${condition}`, admissionTypeId: ctx.admissionTypes['ELECTIVE'],
      consultationStatus: ConsultationStatus.completed,
    },
  });
  await prisma.bed.update({ where: { id: bed.id }, data: { status: 'occupied', currentStayId: stay.id } });
  await prisma.vitalSigns.create({
    data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, recordedById: ctx.staff.nurse.id, recordedAt: daysAgo(1, 8, 10), bloodPressureSystolic: 158, bloodPressureDiastolic: 96, pulse: 88, temperature: 37.1, weight: 82.5, height: 172, spo2: 96 },
  });
  const metformin = ctx.medications['Metformin 500mg Tablets'];
  const rx = await prisma.prescription.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, prescriberId: ctx.staff.doctor.id, status: PrescriptionStatus.dispensed,
      prescribedAt: daysAgo(1, 8, 20), validatedBy: ctx.staff.pharmacist.id, validatedAt: daysAgo(1, 8, 30),
      items: [{ drugCode: metformin.id, drugName: metformin.name, dosage: '1 comprimé 2x/jour', quantity: 60 }] as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.drugDispensing.create({
    data: { tenantId: ctx.tenantId, prescriptionId: rx.id, patientId, pharmacistId: ctx.staff.pharmacist.id, drugCode: metformin.id, drugName: metformin.name, quantity: 60, unit: metformin.unit ?? 'tablets', dispensedAt: daysAgo(1, 9, 0), status: DispensingStatus.dispensed },
  });
  const invoice = await makeConsultationInvoice(ctx, patientId, stay.id, 'CONS_SUIVI');
  await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.pharmacy_dispensation, sourceId: rx.id, description: metformin.name, quantity: 60, unitPrice: Number(metformin.unitPrice ?? 0), amount: 60 * Number(metformin.unitPrice ?? 0) } });
  const recalced = await recalcInvoice(invoice.id);
  const half = Math.floor(recalced.patientAmount.toNumber() / 2);
  await prisma.payment.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: half, method: PaymentMethod.card, status: PaymentStatus.successful, currency: 'XAF', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(1, 9, 30), completedAt: daysAgo(1, 9, 31) } });
  await recalcInvoicePaid(invoice.id, half);
}

async function journeyDayCare(ctx: Ctx, patientId: string, reason: string) {
  const dept = ctx.departments['MED'];
  await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.day_care, status: StayStatus.discharged,
      admissionDate: daysAgo(3, 8, 0), dischargeDate: daysAgo(3, 15, 0), departmentId: dept.id, attendingDoctorId: ctx.staff.doctor.id,
      admissionReason: reason, dischargeSummary: 'Évolution favorable, sortie le jour même.',
      admissionTypeId: ctx.admissionTypes['WALK_IN'], consultationStatus: ConsultationStatus.completed,
    },
  });
}

async function journeyPreAdmission(ctx: Ctx, patientId: string, reason: string) {
  await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.scheduled, status: StayStatus.pre_admission,
      admissionDate: daysFromNow(3, 8, 0), departmentId: ctx.departments['MED'].id, admissionReason: reason,
      admissionTypeId: ctx.admissionTypes['ELECTIVE'],
    },
  });
}

async function journeyTransferred(ctx: Ctx, patientId: string) {
  await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.transferred,
      admissionDate: daysAgo(5, 6, 0), dischargeDate: daysAgo(5, 12, 0), departmentId: ctx.departments['EMER'].id,
      attendingDoctorId: ctx.staff.doctor.id, admissionReason: 'Suspicion AVC — transfert en unité spécialisée',
      dischargeSummary: "Transféré vers un centre disposant d'un plateau de neurologie.",
      admissionTypeId: ctx.admissionTypes['EMERGENCY'], triageAcuity: TriageAcuity.emergent, triagedAt: daysAgo(5, 6, 5),
      consultationStatus: ConsultationStatus.completed,
    },
  });
}

async function journeyDeceased(ctx: Ctx, patientId: string) {
  await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.deceased,
      admissionDate: daysAgo(60, 3, 0), dischargeDate: daysAgo(59, 22, 0), departmentId: ctx.departments['EMER'].id,
      attendingDoctorId: ctx.staff.doctor.id, admissionReason: 'Détresse respiratoire aiguë sur terrain fragile',
      dischargeSummary: 'Décès malgré la prise en charge, en présence de la famille.',
      admissionTypeId: ctx.admissionTypes['EMERGENCY'], triageAcuity: TriageAcuity.resuscitation, triagedAt: daysAgo(60, 3, 2),
      consultationStatus: ConsultationStatus.completed,
    },
  });
  await prisma.patient.update({ where: { id: patientId }, data: { isDeceased: true, deceasedAt: daysAgo(59, 22, 0) } });
}

async function journeySurgery(ctx: Ctx, patientId: string, status: SurgicalStatus, label: string) {
  const stay = status === SurgicalStatus.in_progress || status === SurgicalStatus.completed
    ? await prisma.stay.create({
        data: {
          tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.scheduled, status: StayStatus.in_progress,
          admissionDate: daysAgo(0, 7, 0), departmentId: ctx.departments['SURG'].id, attendingDoctorId: ctx.staff.doctor2.id,
          admissionReason: label, admissionTypeId: ctx.admissionTypes['ELECTIVE'], consultationStatus: ConsultationStatus.completed,
        },
      })
    : null;

  const fullPhase = (items: string[], by: string, at: Date) => ({ items: Object.fromEntries(items.map((i) => [i, true])), completedAt: at.toISOString(), completedBy: by });
  const SIGN_IN = ['patientIdentityConfirmed', 'siteMarked', 'anesthesiaSafetyCheck'];
  const TIME_OUT = ['teamIntroduced', 'criticalStepsReviewed'];
  const SIGN_OUT = ['instrumentCountCorrect', 'specimenLabeled'];

  let whoChecklist: Prisma.InputJsonValue = {} as unknown as Prisma.InputJsonValue;
  if (status === SurgicalStatus.scheduled && label.includes('ready')) {
    whoChecklist = { signIn: fullPhase(SIGN_IN, ctx.staff.nurse.id, daysAgo(0, 7, 0)), timeOut: fullPhase(TIME_OUT, ctx.staff.doctor2.id, daysAgo(0, 7, 10)) } as unknown as Prisma.InputJsonValue;
  } else if (status === SurgicalStatus.in_progress) {
    whoChecklist = { signIn: fullPhase(SIGN_IN, ctx.staff.nurse.id, daysAgo(0, 7, 0)), timeOut: fullPhase(TIME_OUT, ctx.staff.doctor2.id, daysAgo(0, 7, 10)) } as unknown as Prisma.InputJsonValue;
  } else if (status === SurgicalStatus.completed) {
    whoChecklist = {
      signIn: fullPhase(SIGN_IN, ctx.staff.nurse.id, daysAgo(0, 7, 0)),
      timeOut: fullPhase(TIME_OUT, ctx.staff.doctor2.id, daysAgo(0, 7, 10)),
      signOut: fullPhase(SIGN_OUT, ctx.staff.nurse.id, daysAgo(0, 9, 25)),
    } as unknown as Prisma.InputJsonValue;
  }

  const surgery = await prisma.surgicalProcedure.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay?.id, surgeonId: ctx.staff.doctor2.id, roomId: ctx.beds['SURG-02']?.id,
      procedureLabel: label, status,
      scheduledAt: status === SurgicalStatus.completed ? daysAgo(0, 7, 0) : status === SurgicalStatus.cancelled || status === SurgicalStatus.postponed ? daysAgo(2, 9, 0) : daysFromNow(1, 9, 0),
      startedAt: status === SurgicalStatus.in_progress || status === SurgicalStatus.completed ? daysAgo(0, 7, 15) : undefined,
      endedAt: status === SurgicalStatus.completed ? daysAgo(0, 9, 30) : undefined,
      asaScore: 2, whoChecklist,
      surgicalReport: status === SurgicalStatus.completed ? 'Intervention réalisée sans complication, suites simples.' : status === SurgicalStatus.postponed ? 'Reportée — bilan pré-opératoire à compléter.' : undefined,
    },
  });

  if (status === SurgicalStatus.completed && stay) {
    await prisma.medicalRecord.create({
      data: {
        tenantId: ctx.tenantId, patientId, stayId: stay.id, authorId: ctx.staff.doctor2.id, type: MedicalRecordType.surgery_report,
        title: 'Compte-rendu opératoire', content: `${label}. Intervention réalisée sans complication.`,
        isSigned: true, signedAt: daysAgo(0, 9, 35), signedBy: ctx.staff.doctor2.id, signatureHash: crypto.createHash('sha256').update(surgery.id).digest('hex'),
      },
    });
    const invoice = await prisma.patientInvoice.create({ data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF' } });
    await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.surgery, sourceId: surgery.id, description: label, quantity: 1, unitPrice: 120000, amount: 120000 } });
    await recalcInvoice(invoice.id);
  }
}

async function journeyExamWorkup(ctx: Ctx, patientId: string, type: ExamType, examCode: string, status: ExamRequestStatus, urgency: ExamUrgency) {
  const entry = ctx.examCatalog[examCode];
  const isRadiology = type === ExamType.radiology;
  const dept = isRadiology ? ctx.departments['RAD'] : ctx.departments['LAB'];
  const stay = await prisma.stay.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.outpatient, status: StayStatus.discharged,
      admissionDate: daysAgo(1, 9, 0), dischargeDate: daysAgo(1, 11, 0), departmentId: dept.id, attendingDoctorId: ctx.staff.doctor.id,
      admissionReason: `Bilan — ${entry.nameFr}`, admissionTypeId: ctx.admissionTypes['WALK_IN'], consultationStatus: ConsultationStatus.completed,
    },
  });
  const examRequest = await prisma.examRequest.create({
    data: {
      tenantId: ctx.tenantId, patientId, stayId: stay.id, prescriberId: ctx.staff.doctor.id, type,
      examCode: entry.code, examLabel: entry.nameFr, urgency, status,
      requestedAt: daysAgo(1, 9, 5),
      scheduledAt: status === ExamRequestStatus.requested ? undefined : daysAgo(1, 9, 30),
      completedAt: status === ExamRequestStatus.completed ? daysAgo(1, 10, 0) : undefined,
    },
  });
  if (status === ExamRequestStatus.completed) {
    const performer = isRadiology ? ctx.staff.radiologist.id : ctx.staff.labTech.id;
    await prisma.examResult.create({
      data: {
        tenantId: ctx.tenantId, requestId: examRequest.id, patientId, performerId: performer,
        resultData: (isRadiology
          ? { technique: 'Examen réalisé selon le protocole standard.', findings: 'Pas d\'anomalie significative retrouvée.', impression: 'Examen non contributif.' }
          : { parameters: [{ name: 'Résultat', value: 'Normal', unit: '', referenceRange: 'Normal', flag: 'normal' }] }) as unknown as Prisma.InputJsonValue,
        validatedAt: daysAgo(1, 10, 15), validatedBy: performer,
      },
    });
    const invoice = await prisma.patientInvoice.create({ data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF' } });
    await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.exam, sourceId: examRequest.id, description: entry.nameFr, quantity: 1, unitPrice: isRadiology ? 35000 : 8000, amount: isRadiology ? 35000 : 8000 } });
    await recalcInvoice(invoice.id);
  }
}

async function journeyMaternity(ctx: Ctx, patientId: string, delivered: boolean) {
  if (!delivered) {
    const pregnancy = await prisma.pregnancy.create({
      data: { tenantId: ctx.tenantId, patientId, lastMenstrualPeriod: daysAgo(150), expectedDueDate: daysFromNow(130), gravida: 2, para: 1, status: PregnancyStatus.ongoing, riskFactors: [] as unknown as Prisma.InputJsonValue },
    });
    await prisma.antenatalVisit.create({ data: { tenantId: ctx.tenantId, pregnancyId: pregnancy.id, visitNumber: 1, visitDate: daysAgo(90), gestationalAgeWeeks: 12, performedById: ctx.staff.doctor.id, bloodPressureSystolic: 110, bloodPressureDiastolic: 70, weight: 61.2, fundalHeightCm: 12, ironFolateGiven: true, tetanusVaccineGiven: true, malariaPreventionGiven: false } });
    await prisma.antenatalVisit.create({ data: { tenantId: ctx.tenantId, pregnancyId: pregnancy.id, visitNumber: 2, visitDate: daysAgo(30), gestationalAgeWeeks: 24, performedById: ctx.staff.doctor.id, bloodPressureSystolic: 118, bloodPressureDiastolic: 74, weight: 64.5, fundalHeightCm: 24, fetalHeartRate: 142, ironFolateGiven: true, tetanusVaccineGiven: false, malariaPreventionGiven: true } });
    const hivReq = await prisma.examRequest.create({ data: { tenantId: ctx.tenantId, patientId, pregnancyId: pregnancy.id, prescriberId: ctx.staff.doctor.id, type: ExamType.biology, examCode: 'HIV', examLabel: 'Test rapide VIH (dépistage PTME)', urgency: ExamUrgency.routine, status: ExamRequestStatus.completed, requestedAt: daysAgo(90), scheduledAt: daysAgo(90), completedAt: daysAgo(89) } });
    await prisma.examResult.create({ data: { tenantId: ctx.tenantId, requestId: hivReq.id, patientId, performerId: ctx.staff.labTech.id, resultData: { parameters: [{ name: 'HIV', value: 'Non-réactif', unit: '', referenceRange: 'Non-réactif', flag: 'normal' }] } as unknown as Prisma.InputJsonValue, validatedAt: daysAgo(89), validatedBy: ctx.staff.labTech.id } });
    return;
  }

  const pregnancy = await prisma.pregnancy.create({
    data: { tenantId: ctx.tenantId, patientId, lastMenstrualPeriod: daysAgo(280), expectedDueDate: daysAgo(1), gravida: 1, para: 0, status: PregnancyStatus.delivered, riskFactors: [] as unknown as Prisma.InputJsonValue },
  });
  await prisma.antenatalVisit.create({ data: { tenantId: ctx.tenantId, pregnancyId: pregnancy.id, visitNumber: 1, visitDate: daysAgo(120), gestationalAgeWeeks: 14, performedById: ctx.staff.doctor.id, ironFolateGiven: true, tetanusVaccineGiven: true, malariaPreventionGiven: true } });
  const stay = await prisma.stay.create({
    data: { tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.discharged, admissionDate: daysAgo(1, 2, 0), dischargeDate: daysAgo(0, 10, 0), departmentId: ctx.departments['MAT'].id, bedId: ctx.beds['MAT-01']?.id, attendingDoctorId: ctx.staff.doctor.id, admissionReason: 'Travail actif — accouchement', admissionTypeId: ctx.admissionTypes['MATERNITY'], consultationStatus: ConsultationStatus.completed },
  });
  const delivery = await prisma.delivery.create({
    data: { tenantId: ctx.tenantId, pregnancyId: pregnancy.id, stayId: stay.id, deliveryDate: daysAgo(1, 4, 30), mode: DeliveryMode.vaginal, attendedById: ctx.staff.doctor.id, placentaDelivered: true, bloodLossMl: 250, maternalOutcome: 'Suites de couches simples.', complications: [] as unknown as Prisma.InputJsonValue },
  });
  for (const point of [{ h: 1, cm: 3 }, { h: 3, cm: 5 }, { h: 5, cm: 7 }, { h: 6, cm: 10 }]) {
    await prisma.partographEntry.create({ data: { tenantId: ctx.tenantId, deliveryId: delivery.id, recordedAt: daysAgo(1, 2 + point.h, 0), cervicalDilationCm: point.cm, fetalHeartRate: 138, contractionsPer10Min: 3, contractionDurationSec: 40, maternalPulse: 82, maternalBpSystolic: 112, maternalBpDiastolic: 72, amnioticFluid: 'Claire', recordedById: ctx.staff.nurse.id } });
  }
  const mother = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
  const newbornPatient = await prisma.patient.create({
    data: { tenantId: ctx.tenantId, ipp: `${IPP_PREFIX}NB${Math.floor(Math.random() * 100000)}`, lastName: mother.lastName, firstName: `Nouveau-né de ${mother.firstName}`, birthDate: daysAgo(1, 4, 30), gender: Math.random() > 0.5 ? Gender.M : Gender.F, nationality: 'CM', gdprConsent: true, gdprConsentAt: daysAgo(1) },
  });
  await prisma.newborn.create({ data: { tenantId: ctx.tenantId, deliveryId: delivery.id, patientId: newbornPatient.id, sex: newbornPatient.gender, birthWeightGrams: 3150, apgarScore1Min: 8, apgarScore5Min: 9, vitaminKGiven: true, resuscitationNeeded: false, outcome: 'alive' } });
  await prisma.medicalRecord.create({ data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, authorId: ctx.staff.doctor.id, type: MedicalRecordType.delivery_report, title: "Compte-rendu d'accouchement", content: 'Accouchement par voie basse, nouveau-né vivant, Apgar 8/9.', isSigned: true, signedAt: daysAgo(1, 5, 0), signedBy: ctx.staff.doctor.id, signatureHash: crypto.createHash('sha256').update(delivery.id).digest('hex') } });
  const invoice = await prisma.patientInvoice.create({ data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF' } });
  await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.delivery, sourceId: delivery.id, description: 'Accouchement par voie basse', quantity: 1, unitPrice: 30000, amount: 30000 } });
  await recalcInvoice(invoice.id);
}

async function journeyMalaria(ctx: Ctx, patientId: string, severity: MalariaSeverity) {
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
  const tdr = ctx.examCatalog['MALARIA-TDR'];
  const examRequest = await prisma.examRequest.create({
    data: { tenantId: ctx.tenantId, patientId, prescriberId: ctx.staff.doctor.id, type: ExamType.biology, examCode: tdr.code, examLabel: tdr.nameFr, urgency: severity === MalariaSeverity.severe ? ExamUrgency.stat : ExamUrgency.urgent, status: ExamRequestStatus.completed, requestedAt: daysAgo(2, 10, 0), completedAt: daysAgo(2, 10, 30) },
  });
  const result = await prisma.examResult.create({
    data: { tenantId: ctx.tenantId, requestId: examRequest.id, patientId, performerId: ctx.staff.labTech.id, resultData: { parameters: [{ name: 'Paludisme (TDR)', value: 'Positif', unit: '', referenceRange: 'Négatif', flag: 'high' }] } as unknown as Prisma.InputJsonValue, validatedAt: daysAgo(2, 10, 35), validatedBy: ctx.staff.labTech.id },
  });
  const artemether = ctx.medications['Artemether-Lumefantrine (Coartem) 20/120mg Tablets'];
  const artesunate = ctx.medications['Artesunate Injectable 60mg'];
  const drug = severity === MalariaSeverity.severe ? artesunate : artemether;
  await prisma.malariaCase.create({
    data: {
      tenantId: ctx.tenantId, patientId, examResultId: result.id, testType: MalariaTestType.rdt, result: MalariaResult.positive, severity,
      ageInDaysAtDiagnosis: Math.floor((Date.now() - patient.birthDate.getTime()) / 86400000),
      diagnosedAt: daysAgo(2, 10, 35), diagnosedById: ctx.staff.doctor.id, treatedWithAct: true, treatmentDrugName: drug.name, treatedAt: daysAgo(2, 11, 0),
    },
  });
}

async function journeyTb(ctx: Ctx, patientId: string) {
  const examRequest = await prisma.examRequest.create({
    data: { tenantId: ctx.tenantId, patientId, prescriberId: ctx.staff.doctor.id, type: ExamType.biology, examCode: 'TB-GENEXPERT', examLabel: 'Tuberculose (GeneXpert MTB/RIF)', urgency: ExamUrgency.urgent, status: ExamRequestStatus.completed, requestedAt: daysAgo(15), completedAt: daysAgo(14) },
  });
  const result = await prisma.examResult.create({
    data: { tenantId: ctx.tenantId, requestId: examRequest.id, patientId, performerId: ctx.staff.labTech.id, resultData: { parameters: [{ name: 'MTB détecté', value: 'Oui', unit: '', referenceRange: 'Non détecté', flag: 'high' }, { name: 'Résistance Rifampicine', value: 'Non détectée', unit: '', referenceRange: 'Non détectée', flag: 'normal' }] } as unknown as Prisma.InputJsonValue, validatedAt: daysAgo(14), validatedBy: ctx.staff.labTech.id },
  });
  const tbCase = await prisma.tbCase.create({
    data: { tenantId: ctx.tenantId, patientId, notificationDate: daysAgo(14), caseType: TbCaseType.new_case, classification: TbClassification.pulmonary_bacteriologically_confirmed, hivStatus: TbHivStatus.negative, weightKgAtDiagnosis: 54.2, confirmingExamResultId: result.id, treatmentRegimen: 'RHZE', treatmentStartDate: daysAgo(13), outcome: TbTreatmentOutcome.on_treatment, registeredById: ctx.staff.doctor.id },
  });
  await prisma.tbFollowUp.create({ data: { tenantId: ctx.tenantId, tbCaseId: tbCase.id, followUpDate: daysAgo(0), controlPoint: TbControlPoint.m2, sputumResult: TbSputumResult.negative, weightKg: 55.8, recordedById: ctx.staff.labTech.id } });
}

async function journeyImmunization(ctx: Ctx, patientId: string) {
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
  const doses = [
    { code: 'BCG', name: 'BCG', ageInDays: 2 },
    { code: 'HEPB0', name: 'Hépatite B (naissance)', ageInDays: 2 },
    { code: 'PENTA1', name: 'Penta 1 (DTC+HepB+Hib)', ageInDays: 42 },
  ];
  for (const dose of doses) {
    await prisma.immunization.create({
      data: { tenantId: ctx.tenantId, patientId, antigenCode: dose.code, antigenName: dose.name, doseNumber: 1, administeredAt: new Date(patient.birthDate.getTime() + dose.ageInDays * 86400000), administeredById: ctx.staff.nurse.id, ageInDaysAtAdministration: dose.ageInDays },
    });
  }
}

async function journeyPharmacy(ctx: Ctx, patientId: string, status: PrescriptionStatus) {
  const paracetamol = ctx.medications['Paracetamol 500mg Tablets'];
  const amoxicillin = ctx.medications['Amoxicillin 500mg Capsules'];
  const drug = status === PrescriptionStatus.cancelled ? amoxicillin : paracetamol;
  const rx = await prisma.prescription.create({
    data: {
      tenantId: ctx.tenantId, patientId, prescriberId: ctx.staff.doctor.id, status, prescribedAt: daysAgo(status === PrescriptionStatus.expired ? 45 : 2),
      validatedBy: status === PrescriptionStatus.pending || status === PrescriptionStatus.cancelled ? undefined : ctx.staff.pharmacist.id,
      validatedAt: status === PrescriptionStatus.pending || status === PrescriptionStatus.cancelled ? undefined : daysAgo(2, 9, 0),
      items: [{ drugCode: drug.id, drugName: drug.name, dosage: '1 comprimé 3x/jour', quantity: 10 }] as unknown as Prisma.InputJsonValue,
      notes: status === PrescriptionStatus.cancelled ? 'Annulée — allergie signalée par le patient.' : undefined,
    },
  });
  if (status === PrescriptionStatus.validated || status === PrescriptionStatus.dispensed) {
    const invoice = await prisma.patientInvoice.create({ data: { tenantId: ctx.tenantId, patientId, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.pharmacist.id, currency: 'XAF' } });
    await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.pharmacy_dispensation, sourceId: rx.id, description: drug.name, quantity: 10, unitPrice: Number(drug.unitPrice ?? 0), amount: 10 * Number(drug.unitPrice ?? 0) } });
    const recalced = await recalcInvoice(invoice.id);
    if (status === PrescriptionStatus.dispensed) {
      await prisma.payment.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: recalced.patientAmount, method: PaymentMethod.cash, status: PaymentStatus.successful, currency: 'XAF', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(2, 9, 30), completedAt: daysAgo(2, 9, 30) } });
      await recalcInvoicePaid(invoice.id, recalced.patientAmount.toNumber());
      await prisma.drugDispensing.create({ data: { tenantId: ctx.tenantId, prescriptionId: rx.id, patientId, pharmacistId: ctx.staff.pharmacist.id, drugCode: drug.id, drugName: drug.name, quantity: 10, unit: drug.unit ?? 'tablets', dispensedAt: daysAgo(2, 9, 35), status: DispensingStatus.dispensed } });
      await prisma.medicationInventory.update({ where: { id: drug.id }, data: { stock: { decrement: 10 } } });
    }
  }
}

async function journeyBilling(ctx: Ctx, patientId: string, kind: 'draft' | 'pendingMobile' | 'partiallyPaid' | 'cancelled' | 'failedPayment') {
  const dept = ctx.departments['MED'];
  const stay = await prisma.stay.create({
    data: { tenantId: ctx.tenantId, patientId, stayNumber: nextStayNumber(), type: StayType.outpatient, status: StayStatus.discharged, admissionDate: daysAgo(1, 9, 0), dischargeDate: daysAgo(1, 9, 40), departmentId: dept.id, attendingDoctorId: ctx.staff.doctor.id, admissionReason: 'Consultation', admissionTypeId: ctx.admissionTypes['WALK_IN'], consultationStatus: ConsultationStatus.completed },
  });
  let invoice = await prisma.patientInvoice.create({
    data: { tenantId: ctx.tenantId, patientId, stayId: stay.id, status: BillingInvoiceStatus.draft, issuedById: ctx.staff.billingUser.id, currency: 'XAF', insuranceAmount: kind === 'partiallyPaid' ? 3000 : undefined, notes: kind === 'cancelled' ? 'Facture annulée — doublon.' : undefined },
  });

  if (kind === 'draft') return;

  await prisma.patientInvoiceLine.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, sourceType: BillingSourceType.consultation, sourceId: stay.id, description: 'Consultation générale', quantity: 1, unitPrice: 5000, amount: 5000 } });
  invoice = await recalcInvoice(invoice.id);

  if (kind === 'cancelled') {
    await prisma.patientInvoice.update({ where: { id: invoice.id }, data: { status: BillingInvoiceStatus.cancelled } });
    return;
  }
  if (kind === 'pendingMobile') {
    await prisma.payment.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: invoice.patientAmount, method: PaymentMethod.mobile_money_mtn, status: PaymentStatus.pending, currency: 'XAF', phoneNumber: '+237 677100099', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(1, 10, 0) } });
    return;
  }
  if (kind === 'partiallyPaid') {
    const half = Math.floor(invoice.patientAmount.toNumber() / 2);
    await prisma.payment.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: half, method: PaymentMethod.card, status: PaymentStatus.successful, currency: 'XAF', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(1, 10, 30), completedAt: daysAgo(1, 10, 31) } });
    await recalcInvoicePaid(invoice.id, half);
    return;
  }
  if (kind === 'failedPayment') {
    await prisma.payment.create({ data: { tenantId: ctx.tenantId, invoiceId: invoice.id, amount: invoice.patientAmount, method: PaymentMethod.mobile_money_orange, status: PaymentStatus.failed, currency: 'XAF', phoneNumber: '+237 677100088', initiatedById: ctx.staff.billingUser.id, initiatedAt: daysAgo(1, 11, 0), failureReason: 'Solde insuffisant.' } });
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding 50 patients with varied care journeys...');

  const tenant = await prisma.tenant.findFirst({ where: { dbSchema: 'public' } });
  if (!tenant) {
    console.error('No tenant found on this install — complete /setup first, then re-run this script.');
    process.exit(1);
    return;
  }

  const existing = await prisma.patient.findFirst({ where: { tenantId: tenant.id, ipp: { startsWith: IPP_PREFIX } } });
  if (existing) {
    console.log(`Patient-journey data already present (found a ${IPP_PREFIX}-prefixed patient) — skipping. Delete patients with ipp starting "${IPP_PREFIX}" to reseed.`);
    return;
  }

  const departments = await ensureDepartments(tenant.id);
  const beds = await ensureBeds(tenant.id, departments);
  const medications = await ensureMedications(tenant.id);
  const staff = await ensureStaff(tenant.id, departments);
  const { admissionTypes, examCatalog, medicalActs } = await loadCatalogRefs(tenant.id);

  const ctx: Ctx = { tenantId: tenant.id, departments, beds, medications, staff, admissionTypes, examCatalog, medicalActs };

  let counters = { emergencyMinorBed: 0, radiologyDone: 0, labDone: 0 };
  const emerBeds = ['EMER-01', 'EMER-02', 'EMER-03'];
  const medBeds = ['MED-01', 'MED-02', 'MED-03', 'MED-04'];
  const radiologyCodes = ['XR-CHEST', 'CT-HEAD', 'US-ABD'];
  const labCodes = ['CBC', 'CMP' in examCatalog ? 'CMP' : 'CBC', 'LIPID' in examCatalog ? 'LIPID' : 'CBC'];

  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const patient = await prisma.patient.create({
      data: {
        tenantId: tenant.id, ipp: `${IPP_PREFIX}${String(i + 1).padStart(4, '0')}`, lastName: p.lastName, firstName: p.firstName,
        birthDate: p.birthDate, gender: p.gender, nationality: 'CM', phone: p.phone, bloodGroup: p.bloodGroup,
        allergies: (p.allergies ?? []) as unknown as Prisma.InputJsonValue,
        chronicConditions: (p.chronicConditions ?? []) as unknown as Prisma.InputJsonValue,
        emergencyContact: { name: 'Contact urgence', phone: '+237 677099999', relation: 'Famille' } as unknown as Prisma.InputJsonValue,
        gdprConsent: true, gdprConsentAt: daysAgo(200),
      },
    });

    switch (p.journey) {
      case 'registered':
        await journeyRegistered(ctx);
        break;
      case 'apptUpcoming':
        await journeyAppointment(ctx, patient.id, AppointmentStatus.booked, daysFromNow(3 + (i % 5), 9, 0), 'Consultation de suivi', ctx.staff.doctor.id);
        break;
      case 'apptNoShow':
        await journeyAppointment(ctx, patient.id, AppointmentStatus.no_show, daysAgo(4, 14, 0), 'Contrôle annuel', ctx.staff.doctor.id);
        break;
      case 'apptCancelled':
        await journeyAppointment(ctx, patient.id, AppointmentStatus.cancelled, daysAgo(10, 11, 0), 'Consultation initiale', ctx.staff.doctor.id);
        break;
      case 'outpatientPaid':
        await journeyOutpatientPaid(ctx, patient.id, i % 4, 'Suivi de routine');
        break;
      case 'emergencyMinor': {
        const bedCode = emerBeds[counters.emergencyMinorBed % emerBeds.length];
        counters.emergencyMinorBed += 1;
        const reasonKeys: (keyof typeof TRIAGE_REASONS)[] = ['suture', 'entorse', 'fievre'];
        await journeyEmergencyMinor(ctx, patient.id, bedCode, reasonKeys[i % reasonKeys.length]);
        break;
      }
      case 'emergencyCritical':
        await journeyEmergencyCritical(ctx, patient.id);
        break;
      case 'chronicFollowUp':
        await journeyChronicFollowUp(ctx, patient.id, medBeds[i % medBeds.length], p.chronicConditions?.[0] ?? 'suivi chronique');
        break;
      case 'dayCare':
        await journeyDayCare(ctx, patient.id, 'Réhydratation — gastro-entérite');
        break;
      case 'preAdmission':
        await journeyPreAdmission(ctx, patient.id, 'Hospitalisation programmée — bilan');
        break;
      case 'transferred':
        await journeyTransferred(ctx, patient.id);
        break;
      case 'deceased':
        await journeyDeceased(ctx, patient.id);
        break;
      case 'surgeryScheduledEmpty':
        await journeySurgery(ctx, patient.id, SurgicalStatus.scheduled, 'Réduction fermée — fracture');
        break;
      case 'surgeryScheduledReady':
        await journeySurgery(ctx, patient.id, SurgicalStatus.scheduled, 'Appendicectomie (ready)');
        break;
      case 'surgeryInProgress':
        await journeySurgery(ctx, patient.id, SurgicalStatus.in_progress, 'Pose de cathéter de dialyse');
        break;
      case 'surgeryCompleted':
        await journeySurgery(ctx, patient.id, SurgicalStatus.completed, 'Cholécystectomie');
        break;
      case 'surgeryCancelled':
        await journeySurgery(ctx, patient.id, SurgicalStatus.cancelled, 'Cure de hernie inguinale');
        break;
      case 'surgeryPostponed':
        await journeySurgery(ctx, patient.id, SurgicalStatus.postponed, 'Ablation de kyste');
        break;
      case 'radiologyWorkup': {
        const code = radiologyCodes[counters.radiologyDone % radiologyCodes.length];
        counters.radiologyDone += 1;
        const statuses = [ExamRequestStatus.requested, ExamRequestStatus.scheduled, ExamRequestStatus.completed];
        await journeyExamWorkup(ctx, patient.id, ExamType.radiology, code, statuses[counters.radiologyDone % statuses.length], ExamUrgency.routine);
        break;
      }
      case 'labWorkup': {
        const code = labCodes[counters.labDone % labCodes.length];
        counters.labDone += 1;
        const statuses = [ExamRequestStatus.in_progress, ExamRequestStatus.completed, ExamRequestStatus.cancelled];
        await journeyExamWorkup(ctx, patient.id, ExamType.biology, code, statuses[counters.labDone % statuses.length], ExamUrgency.routine);
        break;
      }
      case 'maternityOngoing':
        await journeyMaternity(ctx, patient.id, false);
        break;
      case 'maternityDelivered':
        await journeyMaternity(ctx, patient.id, true);
        break;
      case 'malariaSimple':
        await journeyMalaria(ctx, patient.id, MalariaSeverity.simple);
        break;
      case 'malariaSevere':
        await journeyMalaria(ctx, patient.id, MalariaSeverity.severe);
        break;
      case 'tbCase':
        await journeyTb(ctx, patient.id);
        break;
      case 'immunizationChild':
        await journeyImmunization(ctx, patient.id);
        break;
      case 'pharmacyPending':
        await journeyPharmacy(ctx, patient.id, PrescriptionStatus.pending);
        break;
      case 'pharmacyValidated':
        await journeyPharmacy(ctx, patient.id, PrescriptionStatus.validated);
        break;
      case 'pharmacyDispensed':
        await journeyPharmacy(ctx, patient.id, PrescriptionStatus.dispensed);
        break;
      case 'pharmacyCancelled':
        await journeyPharmacy(ctx, patient.id, PrescriptionStatus.cancelled);
        break;
      case 'pharmacyExpired':
        await journeyPharmacy(ctx, patient.id, PrescriptionStatus.expired);
        break;
      case 'billingDraft':
        await journeyBilling(ctx, patient.id, 'draft');
        break;
      case 'billingPendingMobileMoney':
        await journeyBilling(ctx, patient.id, 'pendingMobile');
        break;
      case 'billingPartiallyPaid':
        await journeyBilling(ctx, patient.id, 'partiallyPaid');
        break;
      case 'billingCancelled':
        await journeyBilling(ctx, patient.id, 'cancelled');
        break;
      case 'billingFailedPayment':
        await journeyBilling(ctx, patient.id, 'failedPayment');
        break;
    }

    if (i % 10 === 0) console.log(`  ...${i + 1}/${PATIENTS.length} patients seeded`);
  }

  console.log(`\n${PATIENTS.length} patients seeded across ${new Set(PATIENTS.map((p) => p.journey)).size} distinct journey types.`);
  console.log(`Staff logins: dr.mendo@hospital.test, dr.abena@hospital.test, nurse.kamga@hospital.test, pharmacy.tchinda@hospital.test, lab.ngo@hospital.test, radio.foka@hospital.test, billing.essomba@hospital.test — password "${STAFF_PASSWORD}".`);
}

main()
  .catch((e) => {
    console.error('Error during patient-journey seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
