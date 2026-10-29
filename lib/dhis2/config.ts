import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Dhis2Config } from "./types";

// The facility's DHIS2 connection, stored in TenantSetting under "dhis2" (password encrypted).
export const DHIS2_SETTING_KEY = "dhis2";

export async function getDhis2Config(tenantId: string): Promise<Dhis2Config | null> {
  const setting = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: DHIS2_SETTING_KEY } },
  });
  if (!setting) return null;
  return setting.value as unknown as Dhis2Config;
}

export async function saveDhis2Config(tenantId: string, config: Dhis2Config, updatedBy?: string): Promise<void> {
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: DHIS2_SETTING_KEY } },
    create: { tenantId, key: DHIS2_SETTING_KEY, value: config as unknown as Prisma.InputJsonValue, updatedBy },
    update: { value: config as unknown as Prisma.InputJsonValue, updatedBy },
  });
}

// Everything the API push needs: server, account, organisation unit and data set.
export function hasApiAccess(config: Dhis2Config | null): config is Dhis2Config {
  return Boolean(config?.baseUrl && config.username && config.encryptedPassword && config.orgUnitId && config.dataSetId);
}
