import crypto from "crypto";
import { BillingCycle, InvoiceStatus, LicenseKeyStatus, ModuleStatus, Prisma, SubscriptionStatus, TenantStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const section = () =>
    Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

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
}) {
  const { tenantId, rawLicenseKey, redeemedByUserId } = args;
  const normalizedKey = rawLicenseKey.trim().toUpperCase();
  const licenseHash = hashLicenseKey(normalizedKey);
  const now = new Date();

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
    },
  });

  if (!license) {
    throw new Error("Invalid license key.");
  }

  if (license.tenantId !== tenantId) {
    throw new Error("This license key does not belong to your tenant.");
  }

  if (license.revokedAt) {
    throw new Error("This license key has been revoked.");
  }

  if (license.redeemedAt) {
    throw new Error("This license key has already been used.");
  }

  const period = normalizePeriod(license.period);
  const periodEnd = addPeriod(now, period);

  const redeemed = await prisma.$transaction(async (tx) => {
      if (!license.subscriptionId) {
        throw new Error("License key is not linked to a subscription.");
      }

      const subscription = await tx.subscription.update({
        where: { id: license.subscriptionId },
        data: {
          status: SubscriptionStatus.active,
          currentPeriodStart: now,
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
          validFrom: now,
          validUntil: subscription.currentPeriodEnd,
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
          lineItems: lineItems as any,
        },
      });

      return subscription;
  });

  const access = await syncTenantStatus(tenantId);

  return {
    subscriptionId: redeemed.id,
    activeUntil: access.validUntil,
  };
}
