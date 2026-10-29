import prisma from "@/lib/prisma";
import { overlaps } from "@/lib/surgery/validation";

// Imaging devices (rooms / machines) and their bookings.

export const DEFAULT_EXAM_DURATION_MINUTES = 20;
const MAX_EXAM_MINUTES = 8 * 60;

export interface ImagingDeviceInput {
  code?: string;
  label?: string;
  modalityItemId?: string | null;
  isActive?: boolean;
}

// Validates a device form; with `partial` (an update) only the given fields are checked.
export async function parseImagingDevice(
  tenantId: string,
  raw: unknown,
  { partial }: { partial: boolean }
): Promise<{ ok: true; value: ImagingDeviceInput } | { ok: false; error: string }> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_body" };
  const body = raw as Record<string, unknown>;
  const value: ImagingDeviceInput = {};
  if (!partial || body.code !== undefined) {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9_-]{1,30}$/.test(code)) return { ok: false, error: "invalid_code" };
    value.code = code;
  }
  if (!partial || body.label !== undefined) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label || label.length > 150) return { ok: false, error: "invalid_label" };
    value.label = label;
  }
  if (body.modalityItemId !== undefined) {
    const id = typeof body.modalityItemId === "string" && body.modalityItemId ? body.modalityItemId : null;
    if (id) {
      const modality = await prisma.referenceCatalogItem.findFirst({ where: { id, tenantId, catalogType: "imaging_type" }, select: { id: true } }).catch(() => null);
      if (!modality) return { ok: false, error: "unknown_modality" };
    }
    value.modalityItemId = id;
  }
  if (body.isActive !== undefined) value.isActive = body.isActive === true;
  return { ok: true, value };
}

export interface DeviceConflict {
  examRequestId: string;
  examLabel: string;
  scheduledAt: string;
}

// Other active bookings of the device overlapping [scheduledAt, scheduledAt + duration).
export async function findDeviceConflicts(
  tenantId: string | null,
  deviceId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeId?: string
): Promise<DeviceConflict[]> {
  const candidates = await prisma.examRequest.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      tenantId,
      deviceId,
      status: { in: ["scheduled", "in_progress"] },
      scheduledAt: { gte: new Date(scheduledAt.getTime() - MAX_EXAM_MINUTES * 60_000), lt: new Date(scheduledAt.getTime() + durationMinutes * 60_000) },
    },
    select: { id: true, examLabel: true, scheduledAt: true, expectedDurationMinutes: true },
  });
  return candidates
    .filter((c) => c.scheduledAt && overlaps(scheduledAt, durationMinutes, c.scheduledAt, c.expectedDurationMinutes ?? DEFAULT_EXAM_DURATION_MINUTES))
    .map((c) => ({ examRequestId: c.id, examLabel: c.examLabel, scheduledAt: c.scheduledAt!.toISOString() }));
}
