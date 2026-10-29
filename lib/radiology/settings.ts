import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isValidViewerTemplate } from "./safety";

// The facility's radiology settings, in TenantSetting under "radiology".
const KEY = "radiology";

export interface RadiologySettings {
  // PACS viewer URL with "{accession}" (lib/radiology/safety viewerUrl); null when there is no PACS.
  pacsViewerUrlTemplate: string | null;
  // A report must be validated by someone other than its author (double reading).
  requireSecondReader: boolean;
}

const DEFAULTS: RadiologySettings = { pacsViewerUrlTemplate: null, requireSecondReader: false };

export async function getRadiologySettings(tenantId: string | null): Promise<RadiologySettings> {
  if (!tenantId) return DEFAULTS;
  const row = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key: KEY } } });
  const value = (row?.value ?? {}) as Partial<RadiologySettings>;
  return {
    pacsViewerUrlTemplate: typeof value.pacsViewerUrlTemplate === "string" && isValidViewerTemplate(value.pacsViewerUrlTemplate) ? value.pacsViewerUrlTemplate : null,
    requireSecondReader: value.requireSecondReader === true,
  };
}

export async function saveRadiologySettings(tenantId: string, settings: RadiologySettings, updatedBy: string) {
  const value = settings as unknown as Prisma.InputJsonValue;
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: KEY } },
    create: { tenantId, key: KEY, value, updatedBy },
    update: { value, updatedBy },
  });
}
