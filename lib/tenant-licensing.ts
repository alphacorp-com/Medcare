import crypto from "crypto";
import { BillingCycle, InvoiceStatus, LicenseKeyStatus, ModuleStatus, Prisma, SubscriptionStatus, TenantStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

// Shown to the caller for every redemption failure (invalid key, wrong tenant,
// revoked, already used) — deliberately identical in every case. Distinct messages
// per failure reason let an attacker enumerate whether a guessed key exists at all,
// belongs to another tenant, or is merely already-redeemed; the real reason is still
// captured in the audit log below for MedCare's own diagnostics.
const GENERIC_REDEMPTION_ERROR = "Invalid or already-used license key.";

export type ModulePermission = {
  moduleId: string;
  actions: string[];
};

export type TenantAccessState = {
  isActive: boolean;
  source: "license" | "subscription_invoice" | "none";
  reason: string;
  validUntil: string | null;
};

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function addPeriod(from: Date, period: BillingCycle): Date {
  const until = new Date(from);
  if (period === "annual") {
    until.setFullYear(until.getFullYear() + 1);
  } else {
    until.setMonth(until.getMonth() + 1);
  }
  return until;
}

function normalizePeriod(period: BillingCycle): BillingCycle {
  return period === "annual" ? "annual" : "monthly";
}

export function createLicenseKey(): string {
  // A license key grants paid access to a tenant — it's a security token, not a
  // display string, so it must come from a CSPRNG. Math.random() (V8's xorshift128+)
  // is predictable given enough observed outputs and must never back a credential;
  // crypto.randomInt gives unbiased, cryptographically-secure selection per character,
  // the same class of primitive already used by generateTemporaryPassword() below.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const section = () =>
    Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");

  return `${section()}-${section()}-${section()}-${section()}`;
}

export function hashLicenseKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim().toUpperCase()).digest("hex");
}

// Generates a random, human-typeable temporary password for platform-created accounts
// (e.g. a tenant's initial admin user), shown once to the platform operator to relay.
export function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

// Resolves how many active user seats a tenant is currently entitled to, based on its
// current trial/active Subscription's `seatsCount`, capped by the Plan's `maxUsers` if the
// plan defines one. Returns null when the tenant has no trial/active subscription — in that
// case seat count is not enforced (mirrors how module access has no meaning without a plan).
export async function getTenantSeatLimit(tenantId: string): Promise<number | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: [SubscriptionStatus.trial, SubscriptionStatus.active] } },
    orderBy: { currentPeriodEnd: "desc" },
    include: { plan: { select: { maxUsers: true } } },
  });

  if (!subscription) {
    return null;
  }

  if (subscription.plan.maxUsers != null) {
    return Math.min(subscription.seatsCount, subscription.plan.maxUsers);
  }

  return subscription.seatsCount;
}

export async function resolveTenantAccess(tenantId: string): Promise<TenantAccessState> {
  const now = new Date();

  const activeLicense = await prisma.licenseKey.findFirst({
    where: {
      tenantId,
      status: LicenseKeyStatus.redeemed,
      redeemedAt: { not: null },
      revokedAt: null,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { validUntil: "desc" },
  });

  if (activeLicense) {
    return {
      isActive: true,
      source: "license",
      reason: "Tenant is active via a valid redeemed license key.",
      validUntil: toIso(activeLicense.validUntil),
    };
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: SubscriptionStatus.active,
      currentPeriodStart: { lte: now },
      currentPeriodEnd: { gte: now },
      plan: {
        billingCycle: { in: [BillingCycle.monthly, BillingCycle.annual] },
      },
    },
    orderBy: { currentPeriodEnd: "desc" },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    return {
      isActive: false,
      source: "none",
      reason: "No active monthly or yearly subscription found.",
      validUntil: null,
    };
  }

  const paidInvoice = await prisma.invoice.findFirst({
    where: {
      tenantId,
      subscriptionId: subscription.id,
      status: InvoiceStatus.paid,
      createdAt: {
        gte: subscription.currentPeriodStart,
        lte: subscription.currentPeriodEnd,
      },
    },
  });

  if (!paidInvoice) {
    return {
      isActive: false,
      source: "none",
      reason: "No valid paid invoice found for the active subscription period.",
      validUntil: toIso(subscription.currentPeriodEnd),
    };
  }

  return {
    isActive: true,
    source: "subscription_invoice",
    reason: "Tenant is active via a paid invoice for an active subscription.",
    validUntil: toIso(subscription.currentPeriodEnd),
  };
}

export async function isModuleActiveForTenant(tenantId: string, moduleCode: string): Promise<boolean> {
  const activeStatuses = [ModuleStatus.active, ModuleStatus.trial];

  const assignment = await prisma.tenantModule.findFirst({
    where: {
      tenantId,
      status: { in: activeStatuses },
      module: { code: moduleCode },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function resolveTenantModules(tenantId: string): Promise<ModulePermission[]> {
  const activeStatuses = [ModuleStatus.active, ModuleStatus.trial];

  const tenantModuleAssignments = await prisma.tenantModule.findMany({
    where: {
      tenantId,
      status: { in: activeStatuses },
    },
    include: {
      module: true,
    },
  });

  return tenantModuleAssignments
    .filter((assignment) => Boolean(assignment.module?.code))
    .map((assignment) => ({
      moduleId: assignment.module.code,
      actions: ["read", "create", "update", "delete"],
    }));
}

export async function syncTenantStatus(tenantId: string): Promise<TenantAccessState> {
  const access = await resolveTenantAccess(tenantId);
  const newStatus = access.isActive ? TenantStatus.active : TenantStatus.suspended;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: newStatus,
      suspendedAt: access.isActive ? null : new Date(),
      churnedAt: null,
    },
  });

  return access;
}

export async function redeemLicenseForTenant(args: {
  tenantId: string;
  rawLicenseKey: string;
  redeemedByUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { tenantId, rawLicenseKey, redeemedByUserId, ipAddress, userAgent } = args;
  const normalizedKey = rawLicenseKey.trim().toUpperCase();
  const licenseHash = hashLicenseKey(normalizedKey);
  const now = new Date();

  // Logs the real reason for MedCare's own audit trail, then throws the generic
  // message the caller actually sees — see GENERIC_REDEMPTION_ERROR above.
  const failRedemption = async (reason: string, licenseId?: string): Promise<never> => {
    await recordAuditEvent({
      tenantId,
      actorId: redeemedByUserId,
      actorType: "tenant_user",
      action: "license.redemption_failed",
      resourceType: "license_key",
      resourceId: licenseId,
      payload: { reason },
      ipAddress,
      userAgent,
    });
    throw new Error(GENERIC_REDEMPTION_ERROR);
  };

  const license = await prisma.licenseKey.findUnique({
    where: { keyHash: licenseHash },
    select: {
      id: true,
      tenantId: true,
      subscriptionId: true,
      period: true,
      status: true,
      redeemedAt: true,
      revokedAt: true,
      redeemedBy: true,
      validFrom: true,
      validUntil: true,
    },
  });

  if (!license) {
    return failRedemption("Key not found.");
  }

  if (license.tenantId !== tenantId) {
    return failRedemption("Key belongs to a different tenant.", license.id);
  }

  if (license.revokedAt) {
    return failRedemption("Key has been revoked.", license.id);
  }

  if (license.redeemedAt) {
    return failRedemption("Key already redeemed.", license.id);
  }

  if (license.validUntil && license.validUntil < now) {
    return failRedemption("Key's validity period has already ended.", license.id);
  }

  const period = normalizePeriod(license.period);

  const redeemed = await prisma.$transaction(async (tx) => {
      if (!license.subscriptionId) {
        throw new Error("License key is not linked to a subscription.");
      }

      // The key's validity window was fixed at generation time from the subscription's
      // own period (see app/api/admin/licenses/route.ts) — redemption activates it as-is
      // rather than computing a fresh "now + one period" window, so a key generated for
      // a specific billing period always grants exactly that period, regardless of when
      // the tenant actually gets around to redeeming it.
      const periodStart = license.validFrom ?? now;
      const periodEnd = license.validUntil ?? addPeriod(now, period);

      const subscription = await tx.subscription.update({
        where: { id: license.subscriptionId },
        data: {
          status: SubscriptionStatus.active,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
        include: {
          plan: true,
        },
      });

      await tx.licenseKey.update({
        where: { id: license.id },
        data: {
          status: LicenseKeyStatus.redeemed,
          redeemedAt: now,
          redeemedBy: redeemedByUserId,
          subscriptionId: license.subscriptionId,
        },
      });

      const invoiceNumber = `LIC-${now.getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const basePrice = Number(subscription.plan.basePrice);
      const pricePerUser = subscription.plan.pricePerUser ? Number(subscription.plan.pricePerUser) : 0;
      const seatsAmount = pricePerUser * subscription.seatsCount;
      const amountHt = basePrice + seatsAmount;

      const lineItems = [
        {
          description: `${subscription.plan.name} plan (${period === "annual" ? "yearly" : "monthly"})`,
          quantity: 1,
          unitAmount: basePrice,
          amount: basePrice,
        },
        {
          description: `User seats (${subscription.seatsCount} included)`,
          quantity: subscription.seatsCount,
          unitAmount: pricePerUser,
          amount: seatsAmount,
        },
      ];

      await tx.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          invoiceNumber,
          amountHt: new Prisma.Decimal(amountHt),
          taxRate: 0,
          currency: subscription.currency,
          status: InvoiceStatus.paid,
          dueDate: now,
          paidAt: now,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
        },
      });

      return subscription;
  });

  const access = await syncTenantStatus(tenantId);

  await recordAuditEvent({
    tenantId,
    actorId: redeemedByUserId,
    actorType: "tenant_user",
    action: "license.redeemed",
    resourceType: "license_key",
    resourceId: license.id,
    payload: { subscriptionId: redeemed.id },
    ipAddress,
    userAgent,
  });

  return {
    subscriptionId: redeemed.id,
    activeUntil: access.validUntil,
  };
}
