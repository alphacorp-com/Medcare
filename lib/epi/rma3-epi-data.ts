import prisma from "@/lib/prisma";
import { TD_GROUP } from "@/lib/maternity/td";
import {
  buildAefiRows,
  buildHpvRows,
  buildVaccinationRows,
  countSessions,
  summarizeColdChain,
  type Rma3AefiRow,
  type Rma3ColdChain,
  type Rma3HpvRow,
  type Rma3SessionCounts,
  type Rma3VaccinationRow,
} from "@/lib/epi/rma3-epi";

// Loads the month's EPI records and builds the RMA3 sections III.1-III.4 and III.6.

export interface Rma3EpiSections {
  sessions: Rma3SessionCounts;
  vaccination: Rma3VaccinationRow[];
  hpv: Rma3HpvRow[];
  coldChain: Rma3ColdChain;
  aefi: Rma3AefiRow[];
}

const HPV_GROUP = "HPV";

export async function computeEpiSections(tenantId: string, start: Date, end: Date): Promise<Rma3EpiSections> {
  const [doses, catalog, sessions, equipment, readings, aefi] = await Promise.all([
    prisma.immunization.findMany({
      where: { tenantId, administeredAt: { gte: start, lt: end } },
      select: {
        antigenCode: true,
        antigenName: true,
        doseNumber: true,
        administeredAt: true,
        isOutOfSchedule: true,
        strategy: true,
        populationGroup: true,
        patient: { select: { gender: true, birthDate: true } },
      },
    }),
    prisma.referenceCatalogItem.findMany({
      where: { catalogType: "vaccine_antigen", OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { order: "asc" },
      select: { code: true, order: true, group: true },
    }),
    prisma.vaccinationSession.findMany({
      where: { tenantId, scheduledDate: { gte: start, lt: end } },
      select: { strategy: true, status: true },
    }),
    // Equipment in service during the month (current status: no status history is kept).
    prisma.coldChainEquipment.findMany({
      where: { tenantId, isActive: true, createdAt: { lt: end } },
      select: { id: true, status: true, minTempC: true, maxTempC: true },
    }),
    prisma.coldChainReading.findMany({
      where: { tenantId, readAt: { gte: start, lt: end } },
      select: { equipmentId: true, temperatureC: true },
    }),
    prisma.aefiReport.findMany({
      where: { tenantId, onsetAt: { gte: start, lt: end } },
      select: { seriousness: true, immunization: { select: { antigenCode: true } } },
    }),
  ]);

  const order = new Map<string, number>();
  const groupOf = new Map<string, string | null>();
  catalog.forEach((item, index) => {
    if (!order.has(item.code)) order.set(item.code, item.order * 1000 + index);
    if (!groupOf.has(item.code)) groupOf.set(item.code, item.group);
  });
  const isHpv = (code: string) => (groupOf.get(code) ?? "").toUpperCase() === HPV_GROUP;
  // Td is given to women (antenatal care, RMA3 II.1.1), not part of the children's III.2.
  const isTd = (code: string) => (groupOf.get(code) ?? "").toUpperCase() === TD_GROUP || code === TD_GROUP;

  return {
    sessions: countSessions(sessions),
    // HPV has its own table (III.3).
    vaccination: buildVaccinationRows(doses.filter((d) => !isHpv(d.antigenCode) && !isTd(d.antigenCode)), order),
    hpv: buildHpvRows(doses.filter((d) => isHpv(d.antigenCode))),
    coldChain: summarizeColdChain(
      equipment.map((e) => ({ ...e, minTempC: Number(e.minTempC), maxTempC: Number(e.maxTempC) })),
      readings.map((r) => ({ equipmentId: r.equipmentId, temperatureC: Number(r.temperatureC) }))
    ),
    aefi: buildAefiRows(aefi.map((r) => ({ seriousness: r.seriousness, antigenCode: r.immunization.antigenCode })), groupOf),
  };
}
