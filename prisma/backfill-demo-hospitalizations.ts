// One-off repair of DEMO data seeded before seed-patient-journeys.ts recorded hospitalisations
// through the real circuit: those stays hold a bed directly (bedId) without hospitalisation
// status, deposit or hospitalisation bed, so the discharges page ("Sorties") stays empty.
//
//   npm run db:backfill-demo-hospitalizations            # dry run: prints what would change
//   npm run db:backfill-demo-hospitalizations -- --apply # writes
//
// Only demo stays are touched (stay number STPJ…, created by the seed), never a real admission.
// Idempotent: a stay already hospitalised is skipped. Back up (or branch on Neon) first.
//   - stay in progress with a bed → hospitalised (deposit of 3 days, paid unless the patient is
//     a vital emergency, whose deposit is settled afterwards);
//   - ended stay with a bed, kept 12 h or more → hospitalised then discharged (deposit
//     regularised to the real length);
//   - ended stay with a bed, kept less than 12 h → the bed is simply released (no hospitalisation).
import 'dotenv/config';
import prisma from '../lib/prisma';
import { hospitalizeDemoStay } from './seed-hospitalization';

const DEMO_STAY_PREFIX = 'STPJ';
const MIN_HOSPITALISATION_MS = 12 * 60 * 60 * 1000;
const ENDED = ['discharged', 'transferred', 'deceased'] as const;

async function main() {
  const apply = process.argv.includes('--apply');
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  if (!tenant) throw new Error('No tenant found on this install.');

  const issuer =
    (await prisma.tenantUser.findFirst({ where: { tenantId: tenant.id, email: 'billing.essomba@hospital.test' }, select: { id: true } })) ??
    (await prisma.tenantUser.findFirst({ where: { tenantId: tenant.id, role: { isSystemAdmin: true } }, select: { id: true } }));
  if (!issuer) throw new Error('No user to record the deposits under.');

  const stays = await prisma.stay.findMany({
    where: { tenantId: tenant.id, stayNumber: { startsWith: DEMO_STAY_PREFIX }, bedId: { not: null }, hospitalizationStatus: null },
    select: { id: true, stayNumber: true, patientId: true, status: true, bedId: true, departmentId: true, admissionDate: true, dischargeDate: true, triageAcuity: true },
    orderBy: { admissionDate: 'asc' },
  });

  const counts = { hospitalised: 0, hospitalisedAndDischarged: 0, bedReleased: 0, skipped: 0 };
  for (const stay of stays) {
    const bed = await prisma.bed.findUnique({ where: { id: stay.bedId! }, select: { id: true, departmentId: true } });
    if (!bed) { counts.skipped += 1; continue; }
    const departmentId = stay.departmentId ?? bed.departmentId;
    const hospitalizedAt = new Date(stay.admissionDate.getTime() + 30 * 60 * 1000);
    const ended = (ENDED as readonly string[]).includes(stay.status);

    if (!ended) {
      counts.hospitalised += 1;
      console.log(`${stay.stayNumber}: in progress → hospitalised`);
      if (apply) {
        const vitalEmergency = stay.triageAcuity === 'resuscitation' || stay.triageAcuity === 'emergent';
        await hospitalizeDemoStay({ tenantId: tenant.id, issuedById: issuer.id, stayId: stay.id, patientId: stay.patientId, bedId: bed.id, departmentId, hospitalizedAt, plannedDays: 3, depositPaid: !vitalEmergency });
      }
      continue;
    }

    const leftAt = stay.dischargeDate ?? stay.admissionDate;
    if (leftAt.getTime() - stay.admissionDate.getTime() >= MIN_HOSPITALISATION_MS) {
      counts.hospitalisedAndDischarged += 1;
      console.log(`${stay.stayNumber}: ended → hospitalised and discharged`);
      if (apply) {
        await hospitalizeDemoStay({ tenantId: tenant.id, issuedById: issuer.id, stayId: stay.id, patientId: stay.patientId, bedId: bed.id, departmentId, hospitalizedAt, plannedDays: 2, leftAt, depositPaid: true });
      }
    } else {
      counts.bedReleased += 1;
      console.log(`${stay.stayNumber}: ended within hours → bed released`);
      if (apply) {
        await prisma.stay.update({ where: { id: stay.id }, data: { bedId: null } });
        await prisma.bed.updateMany({ where: { id: bed.id, currentStayId: stay.id }, data: { status: 'available', currentStayId: null } });
      }
    }
  }

  console.log(`\n${apply ? 'Applied' : 'Dry run (add -- --apply to write)'}:`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
