import { BillingCycle, Prisma, SubscriptionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  syncTenantStatus,
  updateSubscriptionStatus,
} from "@/lib/subscription-sync";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [subscriptions, tenants, plans] = await Promise.all([
      prisma.subscription.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          tenant: { select: { id: true, name: true, slug: true, status: true } },
          plan: { select: { id: true, name: true, billingCycle: true } },
        },
      }),
      prisma.tenant.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, status: true },
      }),
      prisma.plan.findMany({
        where: { billingCycle: { in: [BillingCycle.monthly, BillingCycle.annual] }, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, billingCycle: true, basePrice: true, currency: true },
      }),
    ]);

    return NextResponse.json({ subscriptions, tenants, plans });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, planId, status, currentPeriodStart, currentPeriodEnd } = body;
    if (!tenantId || !planId || !status || !currentPeriodStart || !currentPeriodEnd) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const created = await prisma.subscription.create({
      data: {
        tenantId,
        planId,
        status: status as SubscriptionStatus,
        currentPeriodStart: new Date(currentPeriodStart),
        currentPeriodEnd: new Date(currentPeriodEnd),
        mrr: new Prisma.Decimal(0),
      },
    });

    // Sync tenant status after creating subscription
    await syncTenantStatus(tenantId);

    return NextResponse.json({ subscription: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/subscriptions
 * Update subscription status and sync tenant status
 * Body: { subscriptionId: string, status: SubscriptionStatus }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, status } = body;

    if (!subscriptionId || !status) {
      return NextResponse.json(
        { error: "Missing subscriptionId or status" },
        { status: 400 }
      );
    }

    const validStatuses: SubscriptionStatus[] = [
      "trial",
      "active",
      "past_due",
      "cancelled",
    ];
    if (!validStatuses.includes(status as SubscriptionStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Update subscription and sync tenant status
    await updateSubscriptionStatus(
      subscriptionId,
      status as SubscriptionStatus
    );

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        plan: { select: { id: true, name: true, billingCycle: true } },
      },
    });

    return NextResponse.json({
      message: "Subscription status updated successfully",
      subscription,
    });
  } catch (error) {
    console.error("Error updating subscription status:", error);
    return NextResponse.json(
      { error: "Failed to update subscription status" },
      { status: 500 }
    );
  }
}
