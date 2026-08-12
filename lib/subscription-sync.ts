import prisma from "@/lib/prisma";
import { LicenseKeyStatus, TenantStatus, SubscriptionStatus } from "@prisma/client";

async function revokeLicenseKeysForSubscription(subscriptionId: string): Promise<void> {
  const now = new Date();
  await prisma.licenseKey.updateMany({
    where: { subscriptionId },
    data: {
      status: LicenseKeyStatus.revoked,
      revokedAt: now,
    },
  });
}

/**
 * Sync tenant status based on subscription status
 * - If subscription is active/trial, tenant should be active/trial
 * - If subscription is past_due, tenant should be suspended
 * - If subscription is cancelled, tenant should be churned
 */
export async function syncTenantStatus(tenantId: string): Promise<void> {
  try {
    // Get the tenant's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ["active", "trial", "past_due", "cancelled"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!subscription) {
      // No active subscription found, mark tenant as churned
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: "churned",
          churnedAt: new Date(),
        },
      });
      return;
    }

    let newTenantStatus: TenantStatus;
    const updateData: { suspendedAt?: Date | null; churnedAt?: Date | null } = {};

    switch (subscription.status) {
      case "trial":
        newTenantStatus = "trial";
        break;
      case "active":
        newTenantStatus = "active";
        updateData.suspendedAt = null; // Clear suspension if reactivated
        break;
      case "past_due":
        newTenantStatus = "suspended";
        updateData.suspendedAt = new Date();
        await revokeLicenseKeysForSubscription(subscription.id);
        break;
      case "cancelled":
        newTenantStatus = "churned";
        updateData.churnedAt = new Date();
        await revokeLicenseKeysForSubscription(subscription.id);
        break;
      default:
        return;
    }

    // Update tenant status
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: newTenantStatus,
        ...updateData,
      },
    });
  } catch (error) {
    console.error(
      `Error syncing tenant status for tenant ${tenantId}:`,
      error
    );
    throw error;
  }
}

/**
 * Check for expired subscriptions and mark them as past_due
 * This should be called periodically (e.g., via a cron job)
 */
export async function checkAndUpdateExpiredSubscriptions(): Promise<void> {
  try {
    const now = new Date();

    // Find all subscriptions that have passed their period end date but aren't past_due yet
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        currentPeriodEnd: {
          lt: now, // Period has ended
        },
        status: {
          in: ["active", "trial"], // Only check active/trial subscriptions
        },
      },
    });

    console.log(
      `Found ${expiredSubscriptions.length} expired subscriptions to update`
    );

    // Update each expired subscription
    for (const subscription of expiredSubscriptions) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "past_due",
        },
      });

      // Revoke any license key linked to the expired subscription
      await revokeLicenseKeysForSubscription(subscription.id);

      // Sync tenant status after subscription update
      await syncTenantStatus(subscription.tenantId);

      console.log(
        `Updated subscription ${subscription.id} to past_due, revoked linked license(s), and synced tenant ${subscription.tenantId}`
      );
    }
  } catch (error) {
    console.error("Error checking and updating expired subscriptions:", error);
    throw error;
  }
}

/**
 * Update subscription status and sync tenant status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  newStatus: SubscriptionStatus
): Promise<void> {
  try {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: newStatus,
        ...(newStatus === "cancelled" && { cancelledAt: new Date() }),
      },
    });

    if (newStatus === "past_due" || newStatus === "cancelled") {
      await revokeLicenseKeysForSubscription(subscriptionId);
    }

    // Sync tenant status after subscription update
    await syncTenantStatus(subscription.tenantId);

    console.log(
      `Updated subscription ${subscriptionId} to ${newStatus} and synced tenant status`
    );
  } catch (error) {
    console.error(
      `Error updating subscription ${subscriptionId} status:`,
      error
    );
    throw error;
  }
}
