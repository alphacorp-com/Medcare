// NODE-RUNTIME ONLY. The single place a license token ever gets applied to
// this install — called identically by the online-activate route and the
// offline-import route, so neither path can apply a token differently from
// the other.
import prisma from "@/lib/prisma";
import { recordAuditEvent, SYSTEM_ACTOR_ID } from "@/lib/audit";
import { syncTenantModulesFromLicense } from "@/lib/tenant-licensing";
import { verifyLicenseToken } from "./verify";
import { computeFingerprint, fingerprintInstabilityReason } from "./fingerprint";

export class LicenseApplyError extends Error {}

export async function applyLicenseToken(
  rawToken: string,
  channel: "online" | "offline",
  actorId?: string
): Promise<{ appliedAt: Date; validUntil: Date }> {
  const payload = verifyLicenseToken(rawToken);
  if (!payload) {
    throw new LicenseApplyError("This license file is invalid or has been tampered with.");
  }

  const expectedClientId = process.env.ONPREM_LICENSE_CLIENT_ID;
  if (expectedClientId && payload.clientId !== expectedClientId) {
    throw new LicenseApplyError("This license was issued for a different site — it cannot be applied here.");
  }

  const { raw: currentFingerprint } = computeFingerprint();
  if (payload.fingerprint && payload.fingerprint !== currentFingerprint) {
    const instability = fingerprintInstabilityReason();
    if (instability) throw new LicenseApplyError(instability);
    throw new LicenseApplyError("This license was issued for a different machine — it cannot be applied here.");
  }

  const validUntil = new Date(payload.validUntil);
  const validFrom = new Date(payload.validFrom);

  // Guard against replaying an old-but-validly-signed token to roll back
  // the applied license's expiry: a new token must never regress validUntil
  // relative to what's already applied.
  const existing = await prisma.onPremLicense.findUnique({ where: { id: "current" } });
  if (existing && validUntil.getTime() < existing.validUntil.getTime()) {
    throw new LicenseApplyError(
      "This license expires earlier than the one currently applied — refusing to downgrade."
    );
  }

  const now = new Date();
  const applied = await prisma.onPremLicense.upsert({
    where: { id: "current" },
    create: {
      id: "current",
      token: rawToken,
      jti: payload.jti,
      clientId: payload.clientId,
      tier: payload.tier,
      modules: payload.modules,
      maxUsers: payload.maxUsers,
      maxBeds: payload.maxBeds,
      validFrom,
      validUntil,
      gracePeriodDays: payload.gracePeriodDays,
      fingerprint: payload.fingerprint ?? currentFingerprint,
      channel,
      appliedAt: now,
      lastKnownGoodAt: now,
    },
    update: {
      token: rawToken,
      jti: payload.jti,
      clientId: payload.clientId,
      tier: payload.tier,
      modules: payload.modules,
      maxUsers: payload.maxUsers,
      maxBeds: payload.maxBeds,
      validFrom,
      validUntil,
      gracePeriodDays: payload.gracePeriodDays,
      fingerprint: payload.fingerprint ?? currentFingerprint,
      channel,
      appliedAt: now,
      // lastKnownGoodAt intentionally NOT reset backward here — it only ever
      // ratchets forward, via the guard's own observations (see guard.ts).
    },
  });

  await recordAuditEvent({
    actorId: actorId ?? SYSTEM_ACTOR_ID,
    actorType: actorId ? "tenant_user" : "system",
    action: "onprem_license.applied",
    resourceType: "onprem_license",
    resourceId: payload.jti,
    payload: { channel, tier: payload.tier, validUntil: payload.validUntil },
  });

  // Make the license's module list the actual source of truth for this
  // install's TenantModule rows — otherwise plannedModules chosen in
  // AlphaCorp never affects what's actually enforced here (see
  // isModuleActiveForTenant/resolveTenantModules in lib/tenant-licensing.ts).
  const tenant = await prisma.tenant.findFirst({ where: { dbSchema: "public" }, select: { id: true } });
  if (tenant) {
    await syncTenantModulesFromLicense(tenant.id, payload.modules);
  }

  return { appliedAt: applied.appliedAt, validUntil: applied.validUntil };
}
