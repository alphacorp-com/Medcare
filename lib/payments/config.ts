import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { decryptSecret } from "./crypto";
import type { OrangeMoneyConfig, MtnMomoConfig } from "./mobile-money/types";

const MOBILE_MONEY_SETTING_KEY = "mobile_money_config";

export type MobileMoneyStoredConfig = {
  orange: {
    enabled: boolean;
    clientId: string;
    encryptedClientSecret: string;
    merchantKey: string;
    country: string;
  } | null;
  mtn: {
    enabled: boolean;
    encryptedSubscriptionKey: string;
    apiUserId: string;
    encryptedApiKey: string;
    targetEnvironment: string;
    baseUrl: string;
  } | null;
};

export async function getMobileMoneyConfig(tenantId: string): Promise<MobileMoneyStoredConfig | null> {
  const setting = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: MOBILE_MONEY_SETTING_KEY } },
  });
  if (!setting) return null;
  return setting.value as unknown as MobileMoneyStoredConfig;
}

export async function saveMobileMoneyConfig(
  tenantId: string,
  config: MobileMoneyStoredConfig,
  updatedBy?: string
): Promise<void> {
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: MOBILE_MONEY_SETTING_KEY } },
    create: { tenantId, key: MOBILE_MONEY_SETTING_KEY, value: config as unknown as Prisma.InputJsonValue, updatedBy },
    update: { value: config as unknown as Prisma.InputJsonValue, updatedBy },
  });
}

export function resolveOrangeConfig(stored: MobileMoneyStoredConfig | null): OrangeMoneyConfig | null {
  if (!stored?.orange || !stored.orange.enabled) return null;
  return {
    enabled: true,
    clientId: stored.orange.clientId,
    clientSecret: decryptSecret(stored.orange.encryptedClientSecret),
    merchantKey: stored.orange.merchantKey,
    country: stored.orange.country,
  };
}

export function resolveMtnConfig(stored: MobileMoneyStoredConfig | null): MtnMomoConfig | null {
  if (!stored?.mtn || !stored.mtn.enabled) return null;
  return {
    enabled: true,
    subscriptionKey: decryptSecret(stored.mtn.encryptedSubscriptionKey),
    apiUserId: stored.mtn.apiUserId,
    apiKey: decryptSecret(stored.mtn.encryptedApiKey),
    targetEnvironment: stored.mtn.targetEnvironment,
    baseUrl: stored.mtn.baseUrl,
  };
}
