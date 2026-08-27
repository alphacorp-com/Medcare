// Illustrative demo data covering every workflow documented in the Alpha Corp /
// MedCare presentation: one (or a small handful) of records per status/enum value
// per module, so every possible action of every workflow has something on screen
// to demo. Layers on top of `prisma/seed.ts` (tenant, plans, modules, departments,
// demo users, medication inventory, beds, reference catalogs) — run that first.
//
// Idempotent at a coarse grain: if the demo patients already exist (detected via a
// reserved IPP prefix), the whole clinical dataset is skipped rather than re-created.
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
  ShiftType,
  ScheduleStatus,
  BillingSourceType,
  BillingInvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  AdverseEventType,
  AdverseEventSeverity,
  AdverseEventStatus,
  PregnancyStatus,
  DeliveryMode,
  NotificationType,
  MalariaTestType,
  MalariaResult,
  MalariaSeverity,
  TbCaseType,
  TbClassification,
  TbHivStatus,
  TbTreatmentOutcome,
  TbSputumResult,
  TbControlPoint,
  ModuleStatus,
  LicenseKeyStatus,
  SubscriptionStatus,
  BillingCycle,
  TenantUserRole,
  Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma';

const IPP_PREFIX = 'DEMO';
const STAY_PREFIX = 'STAYDEMO';

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
function timeOnDate(base: Date, hh: number, mm: number): Date {
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

let stayCounter = 0;
function nextStayNumber(): string {
  stayCounter += 1;
  return `${STAY_PREFIX}${String(stayCounter).padStart(4, '0')}`;
}

async function main() {
  console.log('Seeding demo showcase data (run `npm run seed` first if this errors on missing tenant/users)...');

  const tenant = await prisma.tenant.findFirst({ where: { dbSchema: 'public' } });
  if (!tenant) throw new Error('No tenant found — run `npm run seed` first.');

  const adminUser = await prisma.adminUser.findUnique({ where: { email: 'admin@medcare.com' } });
  if (!adminUser) throw new Error('Platform admin not found — run `npm run seed` first.');

  const existingDemoPatient = await prisma.patient.findFirst({
    where: { tenantId: tenant.id, ipp: { startsWith: IPP_PREFIX } },
  });
  if (existingDemoPatient) {
    console.log('Demo showcase data already present (found a DEMO-prefixed patient) — skipping. Delete patients with ipp starting "DEMO" to reseed.');
    await prisma.$disconnect();
    return;
  }

  // ── 0. Make every module active for the demo tenant ───────────────────────
  // seed.ts leaves Surgery=trial, Radiology=pending, and Maternity/Planning/
  // Disease Programs/Appointments unassigned — fine for illustrating the
  // platform's module-gating story, but a live demo needs every module usable.
  const allModules = await prisma.module.findMany();
  for (const mod of allModules) {
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: mod.id } },
      update: { status: ModuleStatus.active, activatedAt: new Date(), activatedBy: adminUser.id },
      create: {
        tenantId: tenant.id,
        moduleId: mod.id,
        status: ModuleStatus.active,
        activatedAt: new Date(),
        activatedBy: adminUser.id,
      },
    });
  }
  console.log('All modules set to active for the demo tenant.');

  // ── 0b. Subscription + a redeemed license key (illustrates the licensing path) ──
  const plan = await prisma.plan.findFirst({ where: { name: 'MedCare Yearly' } });
  if (!plan) throw new Error('Expected the "MedCare Yearly" plan from seed.ts.');

  let subscription = await prisma.subscription.findFirst({ where: { tenantId: tenant.id, status: SubscriptionStatus.active } });
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: SubscriptionStatus.active,
        currentPeriodStart: daysAgo(30),
        currentPeriodEnd: daysFromNow(335),
        seatsCount: 50,
        bedsCount: 18,
        mrr: plan.basePrice,
        currency: 'XAF',
        paymentMethod: 'bank_transfer',
      },
    });
  }

  const rawLicenseKey = 'DEMO1-DEMO2-DEMO3-DEMO4';
  const keyHash = crypto.createHash('sha256').update(rawLicenseKey).digest('hex');
  await prisma.licenseKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: plan.id,
      subscriptionId: subscription.id,
      keyHash,
      keyPreview: 'DEMO1-****-****-DEMO4',
      period: BillingCycle.annual,
      status: LicenseKeyStatus.redeemed,
      issuedBy: adminUser.id,
      redeemedBy: adminUser.id,
      redeemedAt: daysAgo(30),
      validFrom: daysAgo(30),
      validUntil: daysFromNow(335),
    },
  });
  console.log('Subscription and a redeemed license key ensured.');

  // ── 1. Staff we'll act as ──────────────────────────────────────────────────
  const departments = Object.fromEntries(
    (await prisma.department.findMany({ where: { tenantId: tenant.id } })).map((d) => [d.code, d])
  );

  const tenantAdmin = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'admin@hospital.com' } });
  const doctor = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'doctor@hospital.com' } });
  const nurse = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'nurse@hospital.com' } });
  const pharmacist = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'pharmacy@hospital.com' } });
  const labTech = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'lab@hospital.com' } });
  const billingUser = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'billing@hospital.com' } });
  const hrUser = await prisma.tenantUser.findUniqueOrThrow({ where: { email: 'hr@hospital.com' } });

  // Radiologist wasn't in the base seed's 7 demo accounts — add it so every role
  // named in the presentation has a real, working login.
  const demoPassword = await bcrypt.hash('password123', 10);
  const radiologist = await prisma.tenantUser.upsert({
    where: { email: 'radiology@hospital.com' },
    update: {},
    create: {
      email: 'radiology@hospital.com',
      fullName: 'Dr. Alice Scanner',
      role: TenantUserRole.radiologist,
      passwordHash: demoPassword,
      isActive: true,
      tenantId: tenant.id,
      departmentId: departments['RAD']?.id,
      modules: [
        { moduleId: 'MODULE_CORE_PATIENT', actions: ['read', 'create', 'update'] },
        { moduleId: 'MODULE_RADIOLOGY', actions: ['read', 'create', 'update', 'delete'] },
      ],
    },
  });
  console.log('Staff accounts ready (added radiology@hospital.com / password123).');

  // ── 2. Doctor's bookable weekly availability (Mon–Fri 08:00–16:00) ─────────
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.doctorAvailability.upsert({
      where: { tenantId_doctorId_weekday: { tenantId: tenant.id, doctorId: doctor.id, weekday } },
      update: {},
      create: { tenantId: tenant.id, doctorId: doctor.id, weekday, startTime: '08:00', endTime: '16:00', slotMinutes: 20 },
    });
  }
  console.log('Doctor availability ensured (Mon–Fri).');

  // ── 3. Patients ─────────────────────────────────────────────────────────
  type PSeed = {
    key: string; ipp: string; lastName: string; firstName: string; birthDate: Date; gender: Gender;
    phone?: string; bloodGroup?: string; allergies?: string[]; chronicConditions?: string[];
  };
  const patientSeeds: PSeed[] = [
    { key: 'jean', ipp: `${IPP_PREFIX}0001`, lastName: 'Mbarga', firstName: 'Jean', birthDate: yearsAgo(34), gender: Gender.M, phone: '+237 677000001', bloodGroup: 'O+', allergies: ['Pénicilline'] },
    { key: 'marie', ipp: `${IPP_PREFIX}0002`, lastName: 'Talla', firstName: 'Marie', birthDate: yearsAgo(45), gender: Gender.F, phone: '+237 677000002', bloodGroup: 'A+' },
    { key: 'paul', ipp: `${IPP_PREFIX}0003`, lastName: 'Nkeng', firstName: 'Paul', birthDate: yearsAgo(58), gender: Gender.M, phone: '+237 677000003', chronicConditions: ['Hypertension artérielle'] },
    { key: 'sarah', ipp: `${IPP_PREFIX}0004`, lastName: 'Etoundi', firstName: 'Sarah', birthDate: yearsAgo(29), gender: Gender.F, phone: '+237 677000004' },
    { key: 'robert', ipp: `${IPP_PREFIX}0005`, lastName: 'Fouda', firstName: 'Robert', birthDate: yearsAgo(67), gender: Gender.M, phone: '+237 677000005', chronicConditions: ['Diabète type 2', 'Insuffisance rénale'] },
    { key: 'alphonse', ipp: `${IPP_PREFIX}0006`, lastName: 'Biya', firstName: 'Alphonse', birthDate: yearsAgo(72), gender: Gender.M, phone: '+237 677000006' },
    { key: 'aminatou', ipp: `${IPP_PREFIX}0007`, lastName: 'Njoya', firstName: 'Aminatou', birthDate: yearsAgo(31), gender: Gender.F, phone: '+237 677000007' },
    { key: 'grace', ipp: `${IPP_PREFIX}0008`, lastName: 'Belinga', firstName: 'Grace', birthDate: yearsAgo(26), gender: Gender.F, phone: '+237 677000008' },
    { key: 'emmanuel', ipp: `${IPP_PREFIX}0009`, lastName: 'Tchoua', firstName: 'Emmanuel', birthDate: yearsAgo(8), gender: Gender.M },
    { key: 'fatima', ipp: `${IPP_PREFIX}0010`, lastName: 'Oumarou', firstName: 'Fatima', birthDate: yearsAgo(40), gender: Gender.F, phone: '+237 677000010' },
    { key: 'chantal', ipp: `${IPP_PREFIX}0011`, lastName: 'Ateba', firstName: 'Chantal', birthDate: yearsAgo(52), gender: Gender.F, phone: '+237 677000011' },
    { key: 'david', ipp: `${IPP_PREFIX}0012`, lastName: 'Mballa', firstName: 'David', birthDate: yearsAgo(50), gender: Gender.M, phone: '+237 677000012' },
  ];

  const patients: Record<string, Awaited<ReturnType<typeof prisma.patient.create>>> = {};
  for (const p of patientSeeds) {
    patients[p.key] = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        ipp: p.ipp,
        lastName: p.lastName,
        firstName: p.firstName,
        birthDate: p.birthDate,
        gender: p.gender,
        nationality: 'CM',
        phone: p.phone,
        bloodGroup: p.bloodGroup,
        allergies: (p.allergies ?? []) as unknown as Prisma.InputJsonValue,
        chronicConditions: (p.chronicConditions ?? []) as unknown as Prisma.InputJsonValue,
        emergencyContact: { name: 'Contact urgence', phone: '+237 677099999', relation: 'Famille' } as unknown as Prisma.InputJsonValue,
        gdprConsent: true,
        gdprConsentAt: daysAgo(200),
      },
    });
  }
  console.log(`${patientSeeds.length} demo patients created.`);

  // ── 4. Beds: pick a spread of statuses across the base-seed bed inventory ──
  const beds = await prisma.bed.findMany({ where: { tenantId: tenant.id } });
  const bedByCode = Object.fromEntries(beds.map((b) => [b.code, b]));
  await prisma.bed.update({ where: { id: bedByCode['EMER-03'].id }, data: { status: 'maintenance' } });
  await prisma.bed.update({ where: { id: bedByCode['SURG-01'].id }, data: { status: 'reserved' } });

  // ── 5. Appointments (all 6 statuses; one converts into a real Stay) ────────
  const admissionTypes = Object.fromEntries(
    (await prisma.referenceCatalogItem.findMany({ where: { tenantId: tenant.id, catalogType: 'admission_type' } })).map((i) => [i.code, i.id])
  );
  const appointmentTypes = Object.fromEntries(
    (await prisma.referenceCatalogItem.findMany({ where: { tenantId: tenant.id, catalogType: 'appointment_type' } })).map((i) => [i.code, i.id])
  );

  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'FOLLOWUP', scheduledAt: daysFromNow(3, 9, 0), status: AppointmentStatus.booked,
      reasonForVisit: 'Suivi tension artérielle', createdBy: tenantAdmin.id,
    },
  });
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.david.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'CONSULTATION', scheduledAt: daysFromNow(5, 10, 0), status: AppointmentStatus.confirmed,
      reasonForVisit: 'Douleurs abdominales récurrentes', createdBy: tenantAdmin.id,
    },
  });
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.david.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'CHECKUP', scheduledAt: daysAgo(4, 14, 0), status: AppointmentStatus.no_show,
      reasonForVisit: 'Contrôle annuel', createdBy: tenantAdmin.id,
    },
  });
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'CONSULTATION', scheduledAt: daysAgo(10, 11, 0), status: AppointmentStatus.cancelled,
      reasonForVisit: 'Consultation initiale', cancelledAt: daysAgo(11), cancelledReason: 'Empêchement du patient', createdBy: tenantAdmin.id,
    },
  });

  // "completed" appointment: a past visit that ran its course.
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'CONSULTATION', scheduledAt: daysAgo(20, 9, 30), status: AppointmentStatus.completed,
      reasonForVisit: 'Consultation de suivi diabète', createdBy: tenantAdmin.id,
    },
  });

  // "checked_in" appointment: converts into a real Stay + outpatient consultation, exactly like the real check-in flow.
  const checkedInAppointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, doctorId: doctor.id, departmentId: departments['MED'].id,
      appointmentTypeCode: 'CONSULTATION', scheduledAt: daysAgo(0, 9, 0), status: AppointmentStatus.booked,
      reasonForVisit: 'Consultation de suivi', createdBy: tenantAdmin.id,
    },
  });
  const chantalStay = await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, stayNumber: nextStayNumber(), type: StayType.outpatient,
      status: StayStatus.in_progress, admissionDate: daysAgo(0, 9, 5), departmentId: departments['MED'].id,
      attendingDoctorId: doctor.id, admissionReason: 'Rendez-vous — suivi', admissionTypeId: admissionTypes['WALK_IN'],
      consultationStatus: ConsultationStatus.waiting,
    },
  });
  await prisma.appointment.update({
    where: { id: checkedInAppointment.id },
    data: { status: AppointmentStatus.checked_in, stayId: chantalStay.id },
  });
  console.log('Appointments seeded across all 6 statuses (one converted to a Stay via check-in).');

  // ── 6. Emergency admissions across all 5 triage levels + queue states ─────
  const triageSeeds: { patientKey: string; acuity: TriageAcuity; bedCode?: string; consultationStatus: ConsultationStatus; reason: string }[] = [
    { patientKey: 'jean', acuity: TriageAcuity.resuscitation, bedCode: 'EMER-01', consultationStatus: ConsultationStatus.claimed, reason: 'Polytraumatisme — accident de la route' },
    { patientKey: 'robert', acuity: TriageAcuity.emergent, bedCode: 'EMER-02', consultationStatus: ConsultationStatus.waiting, reason: 'Douleur thoracique aiguë' },
    { patientKey: 'marie', acuity: TriageAcuity.urgent, consultationStatus: ConsultationStatus.waiting, reason: 'Fièvre élevée persistante' },
    { patientKey: 'paul', acuity: TriageAcuity.less_urgent, consultationStatus: ConsultationStatus.claimed, reason: "Entorse de la cheville" },
    { patientKey: 'sarah', acuity: TriageAcuity.non_urgent, consultationStatus: ConsultationStatus.completed, reason: 'Céphalées légères' },
  ];
  const stays: Record<string, Awaited<ReturnType<typeof prisma.stay.create>>> = { chantal: chantalStay };
  for (const seed of triageSeeds) {
    const bed = seed.bedCode ? bedByCode[seed.bedCode] : null;
    const stay = await prisma.stay.create({
      data: {
        tenantId: tenant.id, patientId: patients[seed.patientKey].id, stayNumber: nextStayNumber(), type: StayType.emergency,
        status: StayStatus.in_progress, admissionDate: daysAgo(0, 7, 30), departmentId: departments['EMER'].id,
        bedId: bed?.id, attendingDoctorId: doctor.id, admissionReason: seed.reason,
        admissionTypeId: admissionTypes['EMERGENCY'], triageAcuity: seed.acuity, triagedAt: daysAgo(0, 7, 35),
        consultationStatus: seed.consultationStatus,
      },
    });
    stays[seed.patientKey] = stay;
    if (bed) {
      await prisma.bed.update({ where: { id: bed.id }, data: { status: 'occupied', currentStayId: stay.id } });
    }
  }
  console.log('Emergency admissions seeded across all 5 triage levels and all 3 consultation-queue states.');

  // ── 7. Other admission types / stay statuses ───────────────────────────────
  // Scheduled admission, day-care, a future pre_admission, a discharged stay, a
  // transferred stay, and a historic deceased stay — rounding out every StayType
  // and StayStatus value.
  const scheduledBed = bedByCode['MED-01'];
  const scheduledStay = await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayNumber: nextStayNumber(), type: StayType.scheduled,
      status: StayStatus.in_progress, admissionDate: daysAgo(1, 8, 0), departmentId: departments['MED'].id,
      bedId: scheduledBed.id, attendingDoctorId: doctor.id, admissionReason: 'Bilan diabète déséquilibré programmé',
      admissionTypeId: admissionTypes['ELECTIVE'], consultationStatus: ConsultationStatus.completed,
    },
  });
  await prisma.bed.update({ where: { id: scheduledBed.id }, data: { status: 'occupied', currentStayId: scheduledStay.id } });
  stays.robert = scheduledStay;

  await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.emmanuel.id, stayNumber: nextStayNumber(), type: StayType.day_care,
      status: StayStatus.discharged, admissionDate: daysAgo(2, 8, 0), dischargeDate: daysAgo(2, 15, 0),
      departmentId: departments['MED'].id, attendingDoctorId: doctor.id, admissionReason: 'Réhydratation — gastro-entérite',
      dischargeSummary: 'Évolution favorable, sortie avec consignes de réhydratation orale.',
      admissionTypeId: admissionTypes['WALK_IN'], consultationStatus: ConsultationStatus.completed,
    },
  });

  await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.fatima.id, stayNumber: nextStayNumber(), type: StayType.scheduled,
      status: StayStatus.pre_admission, admissionDate: daysFromNow(2, 8, 0), departmentId: departments['MED'].id,
      admissionReason: 'Hospitalisation programmée — bilan tuberculose', admissionTypeId: admissionTypes['ELECTIVE'],
    },
  });

  await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.david.id, stayNumber: nextStayNumber(), type: StayType.emergency,
      status: StayStatus.transferred, admissionDate: daysAgo(5, 6, 0), dischargeDate: daysAgo(5, 12, 0),
      departmentId: departments['EMER'].id, attendingDoctorId: doctor.id, admissionReason: 'Suspicion AVC — transfert en unité spécialisée',
      dischargeSummary: 'Transféré vers un centre disposant d\'un plateau de neurologie.',
      admissionTypeId: admissionTypes['EMERGENCY'], triageAcuity: TriageAcuity.emergent, triagedAt: daysAgo(5, 6, 5),
      consultationStatus: ConsultationStatus.completed,
    },
  });

  await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.alphonse.id, stayNumber: nextStayNumber(), type: StayType.emergency,
      status: StayStatus.deceased, admissionDate: daysAgo(60, 3, 0), dischargeDate: daysAgo(59, 22, 0),
      departmentId: departments['EMER'].id, attendingDoctorId: doctor.id, admissionReason: 'Détresse respiratoire aiguë sur terrain fragile',
      dischargeSummary: 'Décès malgré la prise en charge, en présence de la famille.',
      admissionTypeId: admissionTypes['EMERGENCY'], triageAcuity: TriageAcuity.resuscitation, triagedAt: daysAgo(60, 3, 2),
      consultationStatus: ConsultationStatus.completed,
    },
  });
  await prisma.patient.update({ where: { id: patients.alphonse.id }, data: { isDeceased: true, deceasedAt: daysAgo(59, 22, 0) } });
  console.log('Scheduled / day-care / pre-admission / discharged / transferred / deceased stays seeded.');

  // ── 8. Vital signs ──────────────────────────────────────────────────────
  await prisma.vitalSigns.create({
    data: {
      tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, recordedById: nurse.id, recordedAt: daysAgo(0, 7, 40),
      bloodPressureSystolic: 82, bloodPressureDiastolic: 50, pulse: 128, temperature: 35.8, spo2: 89,
    },
  });
  await prisma.vitalSigns.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, recordedById: nurse.id, recordedAt: daysAgo(1, 8, 10),
      bloodPressureSystolic: 158, bloodPressureDiastolic: 96, pulse: 88, temperature: 37.1, weight: 82.5, height: 172, spo2: 96,
    },
  });
  await prisma.vitalSigns.create({
    data: {
      tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, recordedById: nurse.id, recordedAt: daysAgo(0, 7, 50),
      bloodPressureSystolic: 118, bloodPressureDiastolic: 76, pulse: 102, temperature: 39.2, spo2: 97,
    },
  });
  console.log('Vital signs seeded.');

  // ── 9. Medical records (several types, one signed) ────────────────────────
  await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, authorId: doctor.id,
      type: MedicalRecordType.observation, title: 'Observation initiale', content: 'Fièvre à 39,2°C depuis 3 jours, absence de foyer infectieux évident à l\'examen clinique. Bilan biologique et goutte épaisse demandés.',
    },
  });
  await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id, patientId: patients.paul.id, stayId: stays.paul.id, authorId: nurse.id,
      type: MedicalRecordType.nursing_note, title: 'Note infirmière', content: 'Cheville gauche immobilisée, glaçage appliqué, antalgiques administrés. Patient confortable.',
    },
  });
  await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id, patientId: patients.sarah.id, authorId: doctor.id, type: MedicalRecordType.discharge_letter,
      title: 'Lettre de sortie', content: 'Céphalées de tension, examen neurologique normal. Traitement symptomatique et repos conseillés. Consulter à nouveau si aggravation.',
    },
  });
  console.log('Medical records seeded.');

  // ── 10. Pharmacy: prescriptions across every status + dispensing + stock alert ──
  const medications = await prisma.medicationInventory.findMany({ where: { tenantId: tenant.id } });
  const medByName = Object.fromEntries(medications.map((m) => [m.name, m]));
  const paracetamol = medByName['Paracetamol 500mg Tablets'];
  const amoxicillin = medByName['Amoxicillin 500mg Capsules'];
  const artemether = medByName['Artemether-Lumefantrine (Coartem) 20/120mg Tablets'];

  // Push one medication under its stock threshold so the low-stock alert has something to show.
  await prisma.medicationInventory.updateMany({
    where: { tenantId: tenant.id, name: 'Oseltamivir 75mg Capsules' },
    data: { stock: 12 },
  });

  // pending
  await prisma.prescription.create({
    data: {
      tenantId: tenant.id, patientId: patients.paul.id, stayId: stays.paul.id, prescriberId: doctor.id,
      status: PrescriptionStatus.pending, prescribedAt: daysAgo(0, 8, 0),
      items: [{ drugCode: paracetamol.id, drugName: paracetamol.name, dosage: '1 comprimé 3x/jour', quantity: 10 }] as unknown as Prisma.InputJsonValue,
    },
  });

  // cancelled
  await prisma.prescription.create({
    data: {
      tenantId: tenant.id, patientId: patients.sarah.id, prescriberId: doctor.id, status: PrescriptionStatus.cancelled,
      prescribedAt: daysAgo(3), items: [{ drugCode: amoxicillin.id, drugName: amoxicillin.name, dosage: '1 gélule 2x/jour', quantity: 14 }] as unknown as Prisma.InputJsonValue,
      notes: 'Annulée — allergie signalée par le patient après prescription.',
    },
  });

  // expired
  await prisma.prescription.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, prescriberId: doctor.id, status: PrescriptionStatus.expired,
      prescribedAt: daysAgo(45), items: [{ drugCode: paracetamol.id, drugName: paracetamol.name, dosage: '1 comprimé si douleur', quantity: 20 }] as unknown as Prisma.InputJsonValue,
    },
  });

  // validated (billing line auto-created, not yet dispensed/paid)
  const validatedRx = await prisma.prescription.create({
    data: {
      tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, prescriberId: doctor.id,
      status: PrescriptionStatus.validated, prescribedAt: daysAgo(0, 8, 5), validatedBy: pharmacist.id, validatedAt: daysAgo(0, 8, 20),
      items: [{ drugCode: artemether.id, drugName: artemether.name, dosage: '1 comprimé 2x/jour x 3 jours', quantity: 6 }] as unknown as Prisma.InputJsonValue,
    },
  });
  let marieInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, status: BillingInvoiceStatus.draft, issuedById: pharmacist.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: {
      tenantId: tenant.id, invoiceId: marieInvoice.id, sourceType: BillingSourceType.pharmacy_dispensation, sourceId: validatedRx.id,
      description: `Dispensation — ${artemether.name}`, quantity: 6, unitPrice: Number(artemether.unitPrice ?? 0), amount: 6 * Number(artemether.unitPrice ?? 0),
    },
  });
  await recalcInvoice(marieInvoice.id);

  // dispensed (fully processed: prescription -> billing -> paid -> dispensed -> stock decremented)
  const dispensedRx = await prisma.prescription.create({
    data: {
      tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, prescriberId: doctor.id,
      status: PrescriptionStatus.dispensed, prescribedAt: daysAgo(0, 7, 45), validatedBy: pharmacist.id, validatedAt: daysAgo(0, 7, 50),
      items: [{ drugCode: paracetamol.id, drugName: paracetamol.name, dosage: 'Perfusion — protocole urgences', quantity: 4 }] as unknown as Prisma.InputJsonValue,
    },
  });
  let jeanInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, status: BillingInvoiceStatus.draft, issuedById: pharmacist.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: {
      tenantId: tenant.id, invoiceId: jeanInvoice.id, sourceType: BillingSourceType.pharmacy_dispensation, sourceId: dispensedRx.id,
      description: `Dispensation — ${paracetamol.name}`, quantity: 4, unitPrice: Number(paracetamol.unitPrice ?? 0), amount: 4 * Number(paracetamol.unitPrice ?? 0),
    },
  });
  jeanInvoice = await recalcInvoice(jeanInvoice.id);
  await prisma.payment.create({
    data: {
      tenantId: tenant.id, invoiceId: jeanInvoice.id, amount: jeanInvoice.patientAmount, method: PaymentMethod.cash,
      status: PaymentStatus.successful, currency: 'XAF', initiatedById: billingUser.id, initiatedAt: daysAgo(0, 7, 55), completedAt: daysAgo(0, 7, 55),
    },
  });
  await recalcInvoicePaid(jeanInvoice.id, jeanInvoice.patientAmount.toNumber());
  await prisma.drugDispensing.create({
    data: {
      tenantId: tenant.id, prescriptionId: dispensedRx.id, patientId: patients.jean.id, pharmacistId: pharmacist.id, nurseId: nurse.id,
      drugCode: paracetamol.id, drugName: paracetamol.name, quantity: 4, unit: paracetamol.unit, dispensedAt: daysAgo(0, 8, 0),
      administeredAt: daysAgo(0, 8, 5), status: DispensingStatus.administered,
    },
  });
  await prisma.medicationInventory.update({ where: { id: paracetamol.id }, data: { stock: { decrement: 4 } } });
  console.log('Prescriptions seeded across pending/validated/dispensed/cancelled/expired, with the billing↔pharmacy gate illustrated.');

  // ── 11. Laboratory & Radiology ────────────────────────────────────────────
  const labCbc = await prisma.examCatalogEntry.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'CBC' } });
  const labTroponin = await prisma.examCatalogEntry.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'TROP-I' } });
  const labMalariaTdr = await prisma.examCatalogEntry.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'MALARIA-TDR' } });
  const xrChest = await prisma.examCatalogEntry.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'XR-CHEST' } });
  const ctHead = await prisma.examCatalogEntry.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'CT-HEAD' } });

  // requested (routine)
  await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, prescriberId: doctor.id, type: ExamType.biology,
      examCode: labCbc.code, examLabel: labCbc.nameFr, urgency: ExamUrgency.routine, status: ExamRequestStatus.requested, requestedAt: daysAgo(1, 8, 15),
    },
  });
  // scheduled (radiology)
  await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, prescriberId: doctor.id, type: ExamType.radiology,
      examCode: xrChest.code, examLabel: xrChest.nameFr, urgency: ExamUrgency.routine, status: ExamRequestStatus.scheduled,
      requestedAt: daysAgo(1, 8, 20), scheduledAt: daysFromNow(0, 14, 0),
    },
  });
  // in_progress (lab)
  await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, prescriberId: doctor.id, type: ExamType.biology,
      examCode: labMalariaTdr.code, examLabel: labMalariaTdr.nameFr, urgency: ExamUrgency.urgent, status: ExamRequestStatus.in_progress,
      requestedAt: daysAgo(0, 7, 55), scheduledAt: daysAgo(0, 8, 0),
    },
  });
  // cancelled (radiology)
  await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.paul.id, stayId: stays.paul.id, prescriberId: doctor.id, type: ExamType.radiology,
      examCode: 'XR-EXT', examLabel: 'Radiographie des extrémités', urgency: ExamUrgency.routine, status: ExamRequestStatus.cancelled,
      requestedAt: daysAgo(0, 8, 30), notes: 'Annulée — cliniquement non nécessaire après réévaluation.',
    },
  });

  // completed + validated -> auto-billing (lab), routine result
  const sarahExamRequest = await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.sarah.id, prescriberId: doctor.id, type: ExamType.biology,
      examCode: labCbc.code, examLabel: labCbc.nameFr, urgency: ExamUrgency.routine, status: ExamRequestStatus.completed,
      requestedAt: daysAgo(0, 9, 0), scheduledAt: daysAgo(0, 9, 30), completedAt: daysAgo(0, 10, 0),
    },
  });
  const sarahResult = await prisma.examResult.create({
    data: {
      tenantId: tenant.id, requestId: sarahExamRequest.id, patientId: patients.sarah.id, performerId: labTech.id,
      resultData: {
        parameters: [
          { name: 'WBC', value: '6.2', unit: '10^9/L', referenceRange: '4.0-11.0', flag: 'normal' },
          { name: 'RBC', value: '4.6', unit: '10^12/L', referenceRange: '4.2-5.9', flag: 'normal' },
          { name: 'Hemoglobin', value: '13.8', unit: 'g/dL', referenceRange: '13.0-17.0', flag: 'normal' },
          { name: 'Hematocrit', value: '41', unit: '%', referenceRange: '38-50', flag: 'normal' },
          { name: 'Platelets', value: '260', unit: '10^9/L', referenceRange: '150-400', flag: 'normal' },
        ],
      } as unknown as Prisma.InputJsonValue,
      validatedAt: daysAgo(0, 10, 5), validatedBy: labTech.id,
    },
  });
  let sarahInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.sarah.id, status: BillingInvoiceStatus.draft, issuedById: labTech.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: sarahInvoice.id, sourceType: BillingSourceType.exam, sourceId: sarahExamRequest.id, description: labCbc.nameFr, quantity: 1, unitPrice: 8000, amount: 8000 },
  });
  await recalcInvoice(sarahInvoice.id);

  // completed + validated + CRITICAL (lab) -> notifies the prescriber
  const jeanTroponinRequest = await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, prescriberId: doctor.id, type: ExamType.biology,
      examCode: labTroponin.code, examLabel: labTroponin.nameFr, urgency: ExamUrgency.stat, status: ExamRequestStatus.completed,
      requestedAt: daysAgo(0, 7, 42), scheduledAt: daysAgo(0, 7, 50), completedAt: daysAgo(0, 8, 5),
    },
  });
  const jeanTroponinResult = await prisma.examResult.create({
    data: {
      tenantId: tenant.id, requestId: jeanTroponinRequest.id, patientId: patients.jean.id, performerId: labTech.id,
      resultData: {
        parameters: [{ name: 'Troponin I', value: '2.4', unit: 'ng/mL', referenceRange: '< 0.04', flag: 'critical' }],
      } as unknown as Prisma.InputJsonValue,
      isCritical: true, criticalNotifiedAt: daysAgo(0, 8, 6), validatedAt: daysAgo(0, 8, 6), validatedBy: labTech.id,
    },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: jeanInvoice.id, sourceType: BillingSourceType.exam, sourceId: jeanTroponinRequest.id, description: labTroponin.nameFr, quantity: 1, unitPrice: 15000, amount: 15000 },
  });
  jeanInvoice = await recalcInvoice(jeanInvoice.id);
  await prisma.notification.create({
    data: {
      tenantId: tenant.id, recipientId: doctor.id, type: NotificationType.module_event, moduleId: 'MODULE_LAB',
      title: 'Résultat critique — Jean Mbarga', body: `Troponine I à 2,4 ng/mL (seuil critique) pour ${patients.jean.firstName} ${patients.jean.lastName}.`,
      resourceType: 'exam_result', resourceId: jeanTroponinResult.id, actorId: labTech.id, link: `/patients/${patients.jean.id}`,
    },
  });

  // completed radiology + validated -> auto-billing
  const robertCtRequest = await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, prescriberId: doctor.id, type: ExamType.radiology,
      examCode: ctHead.code, examLabel: ctHead.nameFr, urgency: ExamUrgency.urgent, status: ExamRequestStatus.completed,
      requestedAt: daysAgo(1, 9, 0), scheduledAt: daysAgo(1, 10, 0), completedAt: daysAgo(1, 10, 45),
    },
  });
  await prisma.examResult.create({
    data: {
      tenantId: tenant.id, requestId: robertCtRequest.id, patientId: patients.robert.id, performerId: radiologist.id,
      resultData: {
        technique: 'Scanner cérébral sans injection, coupes axiales.',
        findings: "Pas de saignement intracrânien ni de lésion ischémique constituée visible. Pas d'effet de masse.",
        impression: "Scanner cérébral non contributif — absence de saignement ou d'ischémie constituée.",
      } as unknown as Prisma.InputJsonValue,
      validatedAt: daysAgo(1, 11, 0), validatedBy: radiologist.id,
    },
  });
  let robertInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, status: BillingInvoiceStatus.draft, issuedById: radiologist.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: robertInvoice.id, sourceType: BillingSourceType.exam, sourceId: robertCtRequest.id, description: ctHead.nameFr, quantity: 1, unitPrice: 45000, amount: 45000 },
  });
  robertInvoice = await recalcInvoice(robertInvoice.id);
  console.log('Laboratory & Radiology exam requests/results seeded across every status, including a critical-result notification.');

  // ── 12. Surgery: every SurgicalStatus + the WHO checklist gate at each stage ──
  const fullPhase = (items: string[], by: string, at: Date) => ({
    items: Object.fromEntries(items.map((i) => [i, true])),
    completedAt: at.toISOString(),
    completedBy: by,
  });
  const SIGN_IN = ['patientIdentityConfirmed', 'siteMarked', 'anesthesiaSafetyCheck', 'pulseOximeterFunctioning', 'knownAllergyReviewed'];
  const TIME_OUT = ['teamIntroduced', 'patientProcedureSiteConfirmed', 'antibioticProphylaxisGiven', 'criticalStepsReviewed'];
  const SIGN_OUT = ['procedureRecorded', 'instrumentCountCorrect', 'specimenLabeled', 'equipmentIssuesAddressed'];

  // scheduled, checklist empty — illustrates the block: cannot start yet.
  await prisma.surgicalProcedure.create({
    data: {
      tenantId: tenant.id, patientId: patients.paul.id, surgeonId: doctor.id, roomId: bedByCode['SURG-01']?.id,
      procedureLabel: 'Réduction fermée — fracture de cheville', status: SurgicalStatus.scheduled,
      scheduledAt: daysFromNow(1, 9, 0), asaScore: 1, whoChecklist: {} as unknown as Prisma.InputJsonValue,
    },
  });

  // scheduled, Sign In + Time Out complete — ready to start.
  await prisma.surgicalProcedure.create({
    data: {
      tenantId: tenant.id, patientId: patients.marie.id, surgeonId: doctor.id,
      procedureLabel: 'Appendicectomie', status: SurgicalStatus.scheduled, scheduledAt: daysFromNow(0, 15, 0), asaScore: 2,
      whoChecklist: {
        signIn: fullPhase(SIGN_IN, nurse.id, daysAgo(0, 8, 0)),
        timeOut: fullPhase(TIME_OUT, doctor.id, daysAgo(0, 8, 10)),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // in_progress, Sign Out not yet complete — illustrates the second block: cannot complete yet.
  await prisma.surgicalProcedure.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, stayId: stays.robert.id, surgeonId: doctor.id,
      procedureLabel: 'Pose de cathéter de dialyse', status: SurgicalStatus.in_progress, scheduledAt: daysAgo(0, 13, 0), startedAt: daysAgo(0, 13, 20),
      asaScore: 3,
      whoChecklist: {
        signIn: fullPhase(SIGN_IN, nurse.id, daysAgo(0, 13, 0)),
        timeOut: fullPhase(TIME_OUT, doctor.id, daysAgo(0, 13, 10)),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  // completed — full checklist, signed report auto-filed, billing line generated.
  const completedSurgery = await prisma.surgicalProcedure.create({
    data: {
      tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, surgeonId: doctor.id,
      procedureLabel: 'Laparotomie exploratrice — traumatisme abdominal', status: SurgicalStatus.completed,
      scheduledAt: daysAgo(0, 9, 0), startedAt: daysAgo(0, 9, 15), endedAt: daysAgo(0, 11, 30), asaScore: 4,
      surgicalReport: 'Hémopéritoine drainé, plaie splénique suturée avec succès. Patient stabilisé, transfert en réanimation post-opératoire.',
      whoChecklist: {
        signIn: fullPhase(SIGN_IN, nurse.id, daysAgo(0, 9, 0)),
        timeOut: fullPhase(TIME_OUT, doctor.id, daysAgo(0, 9, 12)),
        signOut: fullPhase(SIGN_OUT, nurse.id, daysAgo(0, 11, 25)),
      } as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id, patientId: patients.jean.id, stayId: stays.jean.id, authorId: doctor.id, type: MedicalRecordType.surgery_report,
      title: 'Compte-rendu opératoire', content: 'Laparotomie exploratrice pour traumatisme abdominal. Plaie splénique suturée. Suites immédiates simples.',
      isSigned: true, signedAt: daysAgo(0, 11, 35), signedBy: doctor.id, signatureHash: crypto.createHash('sha256').update(completedSurgery.id).digest('hex'),
    },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: jeanInvoice.id, sourceType: BillingSourceType.surgery, sourceId: completedSurgery.id, description: 'Laparotomie exploratrice', quantity: 1, unitPrice: 250000, amount: 250000 },
  });
  jeanInvoice = await recalcInvoice(jeanInvoice.id);

  // cancelled / postponed
  await prisma.surgicalProcedure.create({
    data: { tenantId: tenant.id, patientId: patients.david.id, surgeonId: doctor.id, procedureLabel: 'Cure de hernie inguinale', status: SurgicalStatus.cancelled, scheduledAt: daysAgo(2, 9, 0) },
  });
  await prisma.surgicalProcedure.create({
    data: {
      tenantId: tenant.id, patientId: patients.chantal.id, surgeonId: doctor.id, procedureLabel: 'Cholécystectomie',
      status: SurgicalStatus.postponed, scheduledAt: daysFromNow(4, 9, 0),
      surgicalReport: 'Reportée — bilan pré-opératoire à compléter.',
    },
  });
  console.log('Surgical procedures seeded across every status, illustrating both WHO checklist enforcement gates.');

  // ── 13. Standalone billing examples (draft / pending / partially paid / cancelled) ──
  const consGen = await prisma.medicalAct.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'CONS_GEN' } });
  const consGenUrg = await prisma.medicalAct.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'CONS_GEN_URG' } });

  // draft — nothing billed to the patient yet.
  await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.david.id, status: BillingInvoiceStatus.draft, issuedById: billingUser.id, currency: 'XAF' },
  });

  // pending_payment — billed, unpaid.
  let paulInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.paul.id, stayId: stays.paul.id, status: BillingInvoiceStatus.draft, issuedById: billingUser.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: paulInvoice.id, sourceType: BillingSourceType.consultation, sourceId: stays.paul.id, description: consGenUrg.nameFr, quantity: 1, unitPrice: Number(consGenUrg.basePrice), amount: Number(consGenUrg.basePrice) },
  });
  paulInvoice = await recalcInvoice(paulInvoice.id);
  await prisma.payment.create({
    data: { tenantId: tenant.id, invoiceId: paulInvoice.id, amount: paulInvoice.patientAmount, method: PaymentMethod.mobile_money_mtn, status: PaymentStatus.pending, currency: 'XAF', phoneNumber: '+237 677000003', initiatedById: billingUser.id, initiatedAt: daysAgo(0, 9, 0) },
  });

  // partially_paid — one insurance-covered consultation, part paid by card, balance outstanding.
  let marieConsultInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.marie.id, stayId: stays.marie.id, status: BillingInvoiceStatus.draft, insuranceAmount: 3000, issuedById: billingUser.id, currency: 'XAF' },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: marieConsultInvoice.id, sourceType: BillingSourceType.consultation, sourceId: `${stays.marie.id}-consult`, description: consGen.nameFr, quantity: 1, unitPrice: Number(consGen.basePrice), amount: Number(consGen.basePrice) },
  });
  marieConsultInvoice = await recalcInvoice(marieConsultInvoice.id);
  const partialAmount = Math.floor(marieConsultInvoice.patientAmount.toNumber() / 2);
  await prisma.payment.create({
    data: { tenantId: tenant.id, invoiceId: marieConsultInvoice.id, amount: partialAmount, method: PaymentMethod.card, status: PaymentStatus.successful, currency: 'XAF', initiatedById: billingUser.id, initiatedAt: daysAgo(0, 9, 30), completedAt: daysAgo(0, 9, 31) },
  });
  await recalcInvoicePaid(marieConsultInvoice.id, partialAmount);

  // cancelled invoice
  const cancelledInvoice = await prisma.patientInvoice.create({
    data: { tenantId: tenant.id, patientId: patients.sarah.id, status: BillingInvoiceStatus.draft, issuedById: billingUser.id, currency: 'XAF', notes: 'Facture annulée — doublon.' },
  });
  await prisma.patientInvoice.update({ where: { id: cancelledInvoice.id }, data: { status: BillingInvoiceStatus.cancelled } });

  // failed Orange Money attempt, for realism of the payment-gateway states.
  await prisma.payment.create({
    data: { tenantId: tenant.id, invoiceId: sarahInvoice.id, amount: sarahInvoice.patientAmount, method: PaymentMethod.mobile_money_orange, status: PaymentStatus.failed, currency: 'XAF', phoneNumber: '+237 677000004', initiatedById: billingUser.id, initiatedAt: daysAgo(0, 10, 30), failureReason: 'Solde insuffisant.' },
  });
  console.log('Billing examples seeded across draft/pending/partially-paid/paid/cancelled invoices and every payment method/status.');

  // ── 14. Planning: a week of shifts across roles, including absent/modified/replaced ──
  const planningStaff = [
    { user: nurse, dept: 'EMER' as const },
    { user: doctor, dept: 'MED' as const },
    { user: pharmacist, dept: 'PHAR' as const },
    { user: labTech, dept: 'LAB' as const },
  ];
  const shiftTimes: Record<string, [string, string]> = {
    morning: ['07:00', '15:00'],
    afternoon: ['15:00', '23:00'],
    night: ['23:00', '07:00'],
  };
  for (let dayOffset = -2; dayOffset <= 4; dayOffset++) {
    const date = daysAgo(-dayOffset);
    date.setHours(0, 0, 0, 0);
    for (const staff of planningStaff) {
      const rotationIndex = (((dayOffset + planningStaff.indexOf(staff)) % 3) + 3) % 3;
      const shiftType = ([ShiftType.morning, ShiftType.afternoon, ShiftType.night] as const)[rotationIndex];
      const [start, end] = shiftTimes[shiftType];
      let status: ScheduleStatus = ScheduleStatus.planned;
      if (dayOffset === -1 && staff.user.id === nurse.id) status = ScheduleStatus.absent;
      else if (dayOffset === 0) status = ScheduleStatus.confirmed;
      else if (dayOffset === 1 && staff.user.id === labTech.id) status = ScheduleStatus.modified;

      await prisma.schedule.upsert({
        where: { userId_date_shiftType: { userId: staff.user.id, date, shiftType } },
        update: {},
        create: {
          tenantId: tenant.id, userId: staff.user.id, departmentId: departments[staff.dept].id, shiftType, date,
          startTime: timeOnDate(date, Number(start.split(':')[0]), Number(start.split(':')[1])),
          endTime: timeOnDate(date, Number(end.split(':')[0]), Number(end.split(':')[1])),
          status,
        },
      });
    }
  }
  // one "replaced" shift, standing in for a HR-driven substitution.
  const replacedDate = daysAgo(-2);
  replacedDate.setHours(0, 0, 0, 0);
  await prisma.schedule.upsert({
    where: { userId_date_shiftType: { userId: pharmacist.id, date: replacedDate, shiftType: ShiftType.on_call } },
    update: {},
    create: {
      tenantId: tenant.id, userId: pharmacist.id, departmentId: departments['PHAR'].id, shiftType: ShiftType.on_call, date: replacedDate,
      startTime: timeOnDate(replacedDate, 18, 0), endTime: timeOnDate(replacedDate, 23, 59),
      status: ScheduleStatus.replaced, replacedBy: hrUser.id, notes: 'Remplacement — congé maladie de dernière minute.',
    },
  });
  console.log('Staff planning seeded (a week of shifts across roles, including absent/modified/replaced).');

  // ── 15. Maternity: one ongoing pregnancy with CPN, one delivered with partograph + newborn ──
  const aminatouPregnancy = await prisma.pregnancy.create({
    data: {
      tenantId: tenant.id, patientId: patients.aminatou.id, lastMenstrualPeriod: daysAgo(150), expectedDueDate: daysFromNow(130),
      gravida: 2, para: 1, status: PregnancyStatus.ongoing, riskFactors: [] as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.antenatalVisit.create({
    data: {
      tenantId: tenant.id, pregnancyId: aminatouPregnancy.id, visitNumber: 1, visitDate: daysAgo(90), gestationalAgeWeeks: 12,
      performedById: doctor.id, bloodPressureSystolic: 110, bloodPressureDiastolic: 70, weight: 61.2, fundalHeightCm: 12,
      ironFolateGiven: true, tetanusVaccineGiven: true, malariaPreventionGiven: false,
    },
  });
  await prisma.antenatalVisit.create({
    data: {
      tenantId: tenant.id, pregnancyId: aminatouPregnancy.id, visitNumber: 2, visitDate: daysAgo(30), gestationalAgeWeeks: 24,
      performedById: doctor.id, bloodPressureSystolic: 118, bloodPressureDiastolic: 74, weight: 64.5, fundalHeightCm: 24, fetalHeartRate: 142,
      ironFolateGiven: true, tetanusVaccineGiven: false, malariaPreventionGiven: true,
    },
  });
  // PTME screening reuses the Laboratory pipeline via pregnancyId.
  const hivPtmeRequest = await prisma.examRequest.create({
    data: {
      tenantId: tenant.id, patientId: patients.aminatou.id, pregnancyId: aminatouPregnancy.id, prescriberId: doctor.id, type: ExamType.biology,
      examCode: 'HIV', examLabel: 'Test rapide VIH (dépistage PTME)', urgency: ExamUrgency.routine, status: ExamRequestStatus.completed,
      requestedAt: daysAgo(90), scheduledAt: daysAgo(90), completedAt: daysAgo(89),
    },
  });
  await prisma.examResult.create({
    data: {
      tenantId: tenant.id, requestId: hivPtmeRequest.id, patientId: patients.aminatou.id, performerId: labTech.id,
      resultData: {
        parameters: [{ name: 'HIV', value: 'Non-réactif', unit: '', referenceRange: 'Non-réactif', flag: 'normal' }],
      } as unknown as Prisma.InputJsonValue,
      validatedAt: daysAgo(89), validatedBy: labTech.id,
    },
  });

  const gracePregnancy = await prisma.pregnancy.create({
    data: {
      tenantId: tenant.id, patientId: patients.grace.id, lastMenstrualPeriod: daysAgo(280), expectedDueDate: daysAgo(1),
      gravida: 1, para: 0, status: PregnancyStatus.delivered, riskFactors: [] as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.antenatalVisit.create({
    data: { tenantId: tenant.id, pregnancyId: gracePregnancy.id, visitNumber: 1, visitDate: daysAgo(120), gestationalAgeWeeks: 14, performedById: doctor.id, ironFolateGiven: true, tetanusVaccineGiven: true, malariaPreventionGiven: true },
  });
  const maternityStay = await prisma.stay.create({
    data: {
      tenantId: tenant.id, patientId: patients.grace.id, stayNumber: nextStayNumber(), type: StayType.emergency, status: StayStatus.discharged,
      admissionDate: daysAgo(1, 2, 0), dischargeDate: daysAgo(0, 10, 0), departmentId: departments['MED'].id, attendingDoctorId: doctor.id,
      admissionReason: 'Travail actif — accouchement', admissionTypeId: admissionTypes['MATERNITY'], consultationStatus: ConsultationStatus.completed,
    },
  });
  const delivery = await prisma.delivery.create({
    data: {
      tenantId: tenant.id, pregnancyId: gracePregnancy.id, stayId: maternityStay.id, deliveryDate: daysAgo(1, 4, 30), mode: DeliveryMode.vaginal,
      attendedById: doctor.id, placentaDelivered: true, bloodLossMl: 250, maternalOutcome: 'Suites de couches simples.',
      complications: [] as unknown as Prisma.InputJsonValue,
    },
  });
  const partographTimes = [
    { h: 1, cm: 3 }, { h: 3, cm: 5 }, { h: 5, cm: 7 }, { h: 6, cm: 10 },
  ];
  for (const point of partographTimes) {
    await prisma.partographEntry.create({
      data: {
        tenantId: tenant.id, deliveryId: delivery.id, recordedAt: daysAgo(1, 2 + point.h, 0), cervicalDilationCm: point.cm,
        fetalHeartRate: 138, contractionsPer10Min: 3, contractionDurationSec: 40, maternalPulse: 82,
        maternalBpSystolic: 112, maternalBpDiastolic: 72, amnioticFluid: 'Claire', recordedById: nurse.id,
      },
    });
  }
  const newbornPatient = await prisma.patient.create({
    data: {
      tenantId: tenant.id, ipp: `${IPP_PREFIX}0013`, lastName: 'Belinga', firstName: "Nouveau-né de Grace", birthDate: daysAgo(1, 4, 30),
      gender: Gender.F, nationality: 'CM', gdprConsent: true, gdprConsentAt: daysAgo(1),
    },
  });
  await prisma.newborn.create({
    data: {
      tenantId: tenant.id, deliveryId: delivery.id, patientId: newbornPatient.id, sex: Gender.F, birthWeightGrams: 3150,
      apgarScore1Min: 8, apgarScore5Min: 9, vitaminKGiven: true, resuscitationNeeded: false, outcome: 'alive',
    },
  });
  await prisma.medicalRecord.create({
    data: {
      tenantId: tenant.id, patientId: patients.grace.id, stayId: maternityStay.id, authorId: doctor.id, type: MedicalRecordType.delivery_report,
      title: "Compte-rendu d'accouchement", content: 'Accouchement par voie basse, nouveau-né de sexe féminin, 3150g, Apgar 8/9. Délivrance complète, pertes estimées à 250mL.',
      isSigned: true, signedAt: daysAgo(1, 5, 0), signedBy: doctor.id, signatureHash: crypto.createHash('sha256').update(delivery.id).digest('hex'),
    },
  });
  await prisma.patientInvoiceLine.create({
    data: { tenantId: tenant.id, invoiceId: (await prisma.patientInvoice.create({ data: { tenantId: tenant.id, patientId: patients.grace.id, stayId: maternityStay.id, status: BillingInvoiceStatus.draft, issuedById: billingUser.id, currency: 'XAF' } })).id, sourceType: BillingSourceType.delivery, sourceId: delivery.id, description: 'Accouchement par voie basse', quantity: 1, unitPrice: 30000, amount: 30000 },
  });
  console.log('Maternity pathway seeded: one ongoing pregnancy with CPN + PTME (via Lab), one delivered with partograph + newborn (own IPP).');

  // ── 16. Disease programs: immunization, malaria, tuberculosis ─────────────
  const vaccineDoses: { code: string; name: string; ageInDays: number }[] = [
    { code: 'BCG', name: 'BCG', ageInDays: 2 },
    { code: 'HEPB0', name: 'Hépatite B (naissance)', ageInDays: 2 },
    { code: 'PENTA1', name: 'Penta 1 (DTC+HepB+Hib)', ageInDays: 42 },
    { code: 'PENTA2', name: 'Penta 2 (DTC+HepB+Hib)', ageInDays: 70 },
    { code: 'RR1', name: 'Rougeole-Rubéole 1ère dose', ageInDays: 270 },
  ];
  for (const dose of vaccineDoses) {
    await prisma.immunization.create({
      data: {
        tenantId: tenant.id, patientId: patients.emmanuel.id, antigenCode: dose.code, antigenName: dose.name, doseNumber: 1,
        administeredAt: new Date(patients.emmanuel.birthDate.getTime() + dose.ageInDays * 86400000),
        administeredById: nurse.id, ageInDaysAtAdministration: dose.ageInDays,
      },
    });
  }

  const emmanuelMalariaResult = await prisma.examResult.create({
    data: {
      tenantId: tenant.id,
      requestId: (
        await prisma.examRequest.create({
          data: {
            tenantId: tenant.id, patientId: patients.emmanuel.id, prescriberId: doctor.id, type: ExamType.biology,
            examCode: labMalariaTdr.code, examLabel: labMalariaTdr.nameFr, urgency: ExamUrgency.urgent, status: ExamRequestStatus.completed,
            requestedAt: daysAgo(6, 10, 0), completedAt: daysAgo(6, 10, 30),
          },
        })
      ).id,
      patientId: patients.emmanuel.id, performerId: labTech.id,
      resultData: {
        parameters: [{ name: 'Paludisme (TDR)', value: 'Positif', unit: '', referenceRange: 'Négatif', flag: 'high' }],
      } as unknown as Prisma.InputJsonValue,
      validatedAt: daysAgo(6, 10, 35), validatedBy: labTech.id,
    },
  });
  await prisma.malariaCase.create({
    data: {
      tenantId: tenant.id, patientId: patients.emmanuel.id, examResultId: emmanuelMalariaResult.id, testType: MalariaTestType.rdt,
      result: MalariaResult.positive, severity: MalariaSeverity.simple, ageInDaysAtDiagnosis: Math.floor((Date.now() - patients.emmanuel.birthDate.getTime()) / 86400000),
      diagnosedAt: daysAgo(6, 10, 35), diagnosedById: doctor.id, treatedWithAct: true, treatmentDrugName: artemether.name, treatedAt: daysAgo(6, 11, 0),
    },
  });
  await prisma.malariaCase.create({
    data: {
      tenantId: tenant.id, patientId: patients.robert.id, testType: MalariaTestType.microscopy, result: MalariaResult.positive,
      severity: MalariaSeverity.severe, isPregnantAtDiagnosis: false, ageInDaysAtDiagnosis: Math.floor((Date.now() - patients.robert.birthDate.getTime()) / 86400000),
      diagnosedAt: daysAgo(1, 9, 0), diagnosedById: doctor.id, treatedWithAct: true, treatmentDrugName: 'Artesunate Injectable 60mg', treatedAt: daysAgo(1, 9, 30),
    },
  });

  const fatimaTbResult = await prisma.examResult.create({
    data: {
      tenantId: tenant.id,
      requestId: (
        await prisma.examRequest.create({
          data: {
            tenantId: tenant.id, patientId: patients.fatima.id, prescriberId: doctor.id, type: ExamType.biology,
            examCode: 'TB-GENEXPERT', examLabel: 'Tuberculose (GeneXpert MTB/RIF)', urgency: ExamUrgency.urgent, status: ExamRequestStatus.completed,
            requestedAt: daysAgo(15), completedAt: daysAgo(14),
          },
        })
      ).id,
      patientId: patients.fatima.id, performerId: labTech.id,
      resultData: {
        parameters: [
          { name: 'MTB détecté', value: 'Oui', unit: '', referenceRange: 'Non détecté', flag: 'high' },
          { name: 'Résistance Rifampicine', value: 'Non détectée', unit: '', referenceRange: 'Non détectée', flag: 'normal' },
        ],
      } as unknown as Prisma.InputJsonValue,
      validatedAt: daysAgo(14), validatedBy: labTech.id,
    },
  });
  const fatimaTbCase = await prisma.tbCase.create({
    data: {
      tenantId: tenant.id, patientId: patients.fatima.id, notificationDate: daysAgo(14), caseType: TbCaseType.new_case,
      classification: TbClassification.pulmonary_bacteriologically_confirmed, hivStatus: TbHivStatus.negative, weightKgAtDiagnosis: 54.2,
      confirmingExamResultId: fatimaTbResult.id, treatmentRegimen: 'RHZE', treatmentStartDate: daysAgo(13), outcome: TbTreatmentOutcome.on_treatment,
      registeredById: doctor.id,
    },
  });
  await prisma.tbFollowUp.create({
    data: { tenantId: tenant.id, tbCaseId: fatimaTbCase.id, followUpDate: daysAgo(0), controlPoint: TbControlPoint.m2, sputumResult: TbSputumResult.negative, weightKg: 55.8, recordedById: labTech.id },
  });
  console.log('Disease-program data seeded: immunization schedule, a simple and a severe malaria case, and a TB case with a follow-up.');

  // ── 17. Adverse events (incident reporting) ────────────────────────────────
  await prisma.adverseEvent.create({
    data: { tenantId: tenant.id, declaredBy: nurse.id, patientId: patients.paul.id, type: AdverseEventType.medication_error, severity: AdverseEventSeverity.minor, description: 'Retard de 30 minutes dans l\'administration d\'un antalgique programmé.', status: AdverseEventStatus.reported },
  });
  await prisma.adverseEvent.create({
    data: { tenantId: tenant.id, declaredBy: nurse.id, patientId: patients.alphonse.id, type: AdverseEventType.fall, severity: AdverseEventSeverity.moderate, description: 'Chute du patient lors d\'un transfert lit-fauteuil, sans fracture identifiée.', status: AdverseEventStatus.under_analysis, immediateAction: 'Examen clinique immédiat, radiographie de contrôle demandée.' },
  });
  await prisma.adverseEvent.create({
    data: {
      tenantId: tenant.id, declaredBy: doctor.id, patientId: patients.jean.id, stayId: stays.jean.id, type: AdverseEventType.procedure_complication,
      severity: AdverseEventSeverity.major, description: 'Saignement post-opératoire ayant nécessité une surveillance rapprochée en réanimation.',
      status: AdverseEventStatus.action_plan, immediateAction: 'Transfusion et surveillance hémodynamique renforcée.',
      actionPlan: [{ action: 'Revue de dossier en réunion de morbi-mortalité', dueDate: daysFromNow(14).toISOString() }] as unknown as Prisma.InputJsonValue,
    },
  });
  console.log('Adverse events seeded across minor/moderate/major severities and reported/under_analysis/action_plan statuses.');

  // ── 18. Notifications & messaging ──────────────────────────────────────────
  await prisma.notification.create({
    data: { tenantId: tenant.id, recipientId: pharmacist.id, type: NotificationType.module_event, moduleId: 'MODULE_PHARMACY', title: 'Stock bas — Oseltamivir 75mg', body: 'Le stock est passé sous le seuil d\'alerte (12 restants, seuil 20).' },
  });
  await prisma.notification.create({
    data: { tenantId: tenant.id, recipientId: tenantAdmin.id, type: NotificationType.system, title: 'Bienvenue sur MedCare', body: 'Votre établissement est actif — tous les modules de démonstration ont été activés.', isRead: true, readAt: daysAgo(0, 6, 0) },
  });

  const erConversation = await prisma.conversation.create({
    data: { tenantId: tenant.id, title: 'Urgences — Lit EMER-01', isGroup: false, createdBy: doctor.id, lastMessageAt: daysAgo(0, 8, 5) },
  });
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: erConversation.id, userId: doctor.id },
      { conversationId: erConversation.id, userId: nurse.id },
    ],
  });
  await prisma.message.create({ data: { conversationId: erConversation.id, senderId: doctor.id, body: 'Patient stabilisé, troponine revenue critique — je programme le bloc.', createdAt: daysAgo(0, 8, 0) } });
  await prisma.message.create({ data: { conversationId: erConversation.id, senderId: nurse.id, body: 'Bien reçu, je prépare le transfert vers le bloc.', createdAt: daysAgo(0, 8, 5) } });
  await prisma.notification.create({
    data: { tenantId: tenant.id, recipientId: nurse.id, type: NotificationType.message, title: 'Nouveau message — Dr. Gregory House', body: 'Patient stabilisé, troponine revenue critique — je programme le bloc.', resourceType: 'conversation', resourceId: erConversation.id, actorId: doctor.id },
  });

  const teamConversation = await prisma.conversation.create({
    data: { tenantId: tenant.id, title: 'Équipe urgences', isGroup: true, createdBy: tenantAdmin.id, lastMessageAt: daysAgo(0, 7, 0) },
  });
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: teamConversation.id, userId: tenantAdmin.id },
      { conversationId: teamConversation.id, userId: doctor.id },
      { conversationId: teamConversation.id, userId: nurse.id },
    ],
  });
  await prisma.message.create({ data: { conversationId: teamConversation.id, senderId: tenantAdmin.id, body: 'Briefing du matin à 7h30 en salle de garde.', createdAt: daysAgo(0, 7, 0) } });
  console.log('Notifications and messaging (1:1 and group) seeded.');

  console.log('\nDemo showcase data seeded successfully. Log in as any of the seeded accounts (password123, or password for the login used in seed.ts) to walk through every workflow.');
}

async function recalcInvoice(invoiceId: string) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const totals = await prisma.patientInvoiceLine.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const subtotal = Number(totals._sum.amount ?? 0);
  const patientAmount = subtotal - Number(invoice.insuranceAmount);
  const paidAmount = Number(invoice.paidAmount);
  const status: BillingInvoiceStatus =
    paidAmount <= 0 ? BillingInvoiceStatus.pending_payment : paidAmount >= patientAmount && patientAmount > 0 ? BillingInvoiceStatus.paid : BillingInvoiceStatus.partially_paid;
  return prisma.patientInvoice.update({ where: { id: invoiceId }, data: { subtotal, patientAmount, status } });
}

async function recalcInvoicePaid(invoiceId: string, paidAmount: number) {
  const invoice = await prisma.patientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const status: BillingInvoiceStatus =
    paidAmount <= 0 ? BillingInvoiceStatus.pending_payment : paidAmount >= Number(invoice.patientAmount) ? BillingInvoiceStatus.paid : BillingInvoiceStatus.partially_paid;
  return prisma.patientInvoice.update({ where: { id: invoiceId }, data: { paidAmount, status } });
}

main()
  .catch((e) => {
    console.error('Error during demo showcase seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
