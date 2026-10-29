import prisma from "@/lib/prisma";

// The people and places a surgery points to are checked against the session's facility: the
// columns are plain ids (no foreign keys), so nothing else stops an id of another facility,
// a deactivated account or a non-clinical user from being recorded.

// Operating rooms are beds whose room type is "SURGICAL" (Paramètres → Lits / Types de salle).
export const OPERATING_ROOM_TYPE_CODE = "SURGICAL";

export async function listOperatingRooms(tenantId: string | null) {
  const roomTypes = await prisma.referenceCatalogItem.findMany({
    where: { tenantId, catalogType: "room_type", code: OPERATING_ROOM_TYPE_CODE },
    select: { id: true },
  });
  if (roomTypes.length === 0) return [];
  return prisma.bed.findMany({
    where: { tenantId, isActive: true, roomTypeId: { in: roomTypes.map((r) => r.id) } },
    select: { id: true, code: true, label: true },
    orderBy: { code: "asc" },
  });
}

// id → "SURG-01 · Bloc opératoire 1", for display (any bed of the tenant, active or not).
export async function roomLabels(tenantId: string | null, ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const beds = await prisma.bed.findMany({ where: { tenantId, id: { in: wanted } }, select: { id: true, code: true, label: true } });
  return new Map(beds.map((b) => [b.id, `${b.code} · ${b.label}`]));
}

export interface SurgeryReferences {
  patientId?: string;
  stayId?: string | null;
  surgeonId?: string;
  anesthesiologistId?: string | null;
  roomId?: string | null;
  // Operating team members: any active account of the facility (nurses are not clinicians).
  teamUserIds?: readonly string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns null when every given reference is valid, else the error to send back.
export async function checkSurgeryReferences(
  tenantId: string | null,
  refs: SurgeryReferences,
  existingPatientId?: string
): Promise<{ error: string; status: number } | null> {
  const given = Object.entries(refs).filter(([, v]) => typeof v === "string" && v !== "") as [string, string][];
  const malformed = given.find(([, v]) => !UUID.test(v));
  if (malformed) return { error: `${malformed[0]} is not a valid id`, status: 400 };

  const patientId = refs.patientId ?? existingPatientId;
  if (refs.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: refs.patientId, tenantId }, select: { id: true } });
    if (!patient) return { error: "Patient not found", status: 404 };
  }
  if (refs.stayId) {
    // The stay must be this patient's.
    const stay = await prisma.stay.findFirst({ where: { id: refs.stayId, tenantId, patientId }, select: { id: true } });
    if (!stay) return { error: "Stay not found for this patient", status: 404 };
  }

  const clinicians = [refs.surgeonId, refs.anesthesiologistId].filter((v): v is string => Boolean(v));
  if (clinicians.length) {
    const found = await prisma.tenantUser.findMany({
      where: { id: { in: clinicians }, tenantId, isActive: true, role: { isClinicalProvider: true } },
      select: { id: true },
    });
    const ok = new Set(found.map((u) => u.id));
    if (refs.surgeonId && !ok.has(refs.surgeonId)) return { error: "The surgeon must be an active clinician of this facility", status: 400 };
    if (refs.anesthesiologistId && !ok.has(refs.anesthesiologistId)) return { error: "The anesthesiologist must be an active clinician of this facility", status: 400 };
  }

  if (refs.teamUserIds?.length) {
    const ids = [...new Set(refs.teamUserIds)];
    const members = await prisma.tenantUser.count({ where: { id: { in: ids }, tenantId, isActive: true } });
    if (members !== ids.length) return { error: "Every team member must be an active account of this facility", status: 400 };
  }

  if (refs.roomId) {
    const room = await prisma.bed.findFirst({ where: { id: refs.roomId, tenantId, isActive: true }, select: { id: true } });
    if (!room) return { error: "Operating room not found", status: 404 };
  }
  return null;
}
