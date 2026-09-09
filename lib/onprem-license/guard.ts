// NODE-RUNTIME ONLY. Enforces the "hard block after grace period" policy,
// with a lightweight defense against a system clock rolled backward to
// dodge expiry — there's no periodic phone-home to catch this remotely
// (see the plan: renewal is always an explicit manual action), so the
// install has to defend against clock tampering locally.
import prisma from "@/lib/prisma";

export interface LicenseGuardResult {
  blocked: boolean;
  reason?: "no_license" | "expired";
  validUntil?: Date;
  gracePeriodEndsAt?: Date;
  clockSuspicious?: boolean;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Only ever moves forward: taking the later of "what the clock says" and
// "the latest time we've legitimately observed" means winding the clock
// back can never make less time appear to have passed than actually did.
function effectiveNow(lastKnownGoodAt: Date): Date {
  const systemNow = new Date();
  return systemNow.getTime() > lastKnownGoodAt.getTime() ? systemNow : lastKnownGoodAt;
}

// Avoid writing to the DB on every single guard check (this runs in the
// dashboard layout, i.e. on every page load) — only ratchet the stored
// watermark forward once it's meaningfully stale.
const LAST_KNOWN_GOOD_UPDATE_THRESHOLD_MS = 5 * 60_000;

export async function checkOnPremLicenseGuard(): Promise<LicenseGuardResult> {
  const license = await prisma.onPremLicense.findUnique({ where: { id: "current" } });
  if (!license) {
    return { blocked: true, reason: "no_license" };
  }

  const now = effectiveNow(license.lastKnownGoodAt);
  const gracePeriodEndsAt = addDays(license.validUntil, license.gracePeriodDays);
  const clockSuspicious = new Date().getTime() < license.lastKnownGoodAt.getTime() - 5 * 60_000;

  if (now.getTime() - license.lastKnownGoodAt.getTime() > LAST_KNOWN_GOOD_UPDATE_THRESHOLD_MS) {
    await prisma.onPremLicense.update({
      where: { id: "current" },
      data: { lastKnownGoodAt: now },
    });
  }

  if (now.getTime() > gracePeriodEndsAt.getTime()) {
    return { blocked: true, reason: "expired", validUntil: license.validUntil, gracePeriodEndsAt, clockSuspicious };
  }

  return { blocked: false, validUntil: license.validUntil, gracePeriodEndsAt, clockSuspicious };
}
