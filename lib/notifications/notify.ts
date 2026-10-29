import prisma from "@/lib/prisma";
import type { ModuleAction } from "@/types/next-auth";
import type { NotificationType } from "@prisma/client";

export interface NotifyModuleInput {
  tenantId: string | null;
  moduleId: string;
  // Minimum action a user must be granted on `moduleId` to be considered eligible. Defaults
  // to "read" — the natural bar for "should know something happened in this module".
  action?: ModuleAction;
  type?: NotificationType;
  title: string;
  body?: string;
  link?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  excludeUserId?: string;
}

// Resolves everyone in a tenant who is currently eligible to be notified about a module event
// — live from the database, not from a cached JWT — then inserts one Notification row per
// recipient. Eligibility requires BOTH:
//   1. The tenant currently has `moduleId` licensed (TenantModule status active/trial). If the
//      tenant's plan doesn't include the module (or the license lapsed), nobody is notified.
//   2. The user's role has `isSystemAdmin` (implicit full access, matching
//      lib/permissions.ts's bypass convention) or they have `action` granted on
//      `moduleId` in their own `modules` grant.
// Returns the number of notifications created.
export async function notifyModule(input: NotifyModuleInput): Promise<number> {
  const action = input.action ?? "read";

  if (input.tenantId) {
    const licensed = await prisma.tenantModule.findFirst({
      where: {
        tenantId: input.tenantId,
        status: { in: ["active", "trial"] },
        module: { code: input.moduleId },
      },
      select: { id: true },
    });
    if (!licensed) {
      return 0;
    }
  }

  const users = await prisma.tenantUser.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    },
    select: { id: true, modules: true, role: { select: { isSystemAdmin: true } } },
  });

  const recipientIds = users
    .filter((user) => {
      if (user.role.isSystemAdmin) return true;
      const modules = (user.modules ?? []) as unknown as { moduleId: string; actions: string[] }[];
      return modules.some((m) => m.moduleId === input.moduleId && m.actions.includes(action));
    })
    .map((user) => user.id);

  if (recipientIds.length === 0) {
    return 0;
  }

  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      tenantId: input.tenantId,
      recipientId,
      type: input.type ?? "module_event",
      moduleId: input.moduleId,
      title: input.title,
      body: input.body,
      link: input.link,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorId: input.actorId,
    })),
  });

  return recipientIds.length;
}

export interface NotifyUserInput extends Omit<NotifyModuleInput, "action" | "excludeUserId"> {
  recipientId: string;
}

// One named recipient (the prescriber of an exam…), still only if they are active in the tenant.
// Returns whether a notification was created; never notifies the actor themself.
export async function notifyUser(input: NotifyUserInput): Promise<boolean> {
  if (input.actorId && input.actorId === input.recipientId) return false;
  const recipient = await prisma.tenantUser.findFirst({
    where: { id: input.recipientId, tenantId: input.tenantId, isActive: true },
    select: { id: true },
  });
  if (!recipient) return false;
  await prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientId: recipient.id,
      type: input.type ?? "module_event",
      moduleId: input.moduleId,
      title: input.title,
      body: input.body,
      link: input.link,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorId: input.actorId,
    },
  });
  return true;
}
