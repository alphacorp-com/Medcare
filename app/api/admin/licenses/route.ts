import { BillingCycle, LicenseKeyStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLicenseKey, hashLicenseKey } from "@/lib/tenant-licensing";

function normalizePeriod(input: string): BillingCycle | null {
  if (input === "monthly") return BillingCycle.monthly;
  if (input === "annual" || input === "yearly") return BillingCycle.annual;
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [tenants, plans, licenses] = await Promise.all([
      prisma.tenant.findMany({
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.plan.findMany({
        where: { billingCycle: { in: [BillingCycle.monthly, BillingCycle.annual] }, isActive: true },
        select: { id: true, name: true, billingCycle: true, basePrice: true, currency: true },
        orderBy: { name: "asc" },
      }),
      prisma.licenseKey.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          keyPreview: true,
          status: true,
          period: true,
          createdAt: true,
          redeemedAt: true,
          validUntil: true,
          tenant: { select: { name: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({ tenants, plans, licenses });
  } catch (error) {
    console.error("Failed to fetch licensing data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const subscriptionId = String(body.subscriptionId || "");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required." },
        { status: 400 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        tenant: { select: { id: true } },
        plan: { select: { id: true, billingCycle: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    }

    const normalizedPeriod = normalizePeriod(subscription.plan.billingCycle);
    if (!normalizedPeriod) {
      return NextResponse.json(
        { error: "Subscription plan must use a monthly or annual billing cycle." },
        { status: 400 }
      );
    }

    const rawKey = createLicenseKey();
    const keyHash = hashLicenseKey(rawKey);
    const keyPreview = `${rawKey.slice(0, 5)}-*****-*****-${rawKey.slice(-5)}`;

    await prisma.licenseKey.create({
      data: {
        tenantId: subscription.tenant.id,
        planId: subscription.plan.id,
        subscriptionId,
        period: normalizedPeriod,
        keyHash,
        keyPreview,
        status: LicenseKeyStatus.generated,
        issuedBy: session.user.id,
      },
    });

    return NextResponse.json({
      key: rawKey,
      keyPreview,
      period: normalizedPeriod,
      message: "License key generated successfully.",
    });
  } catch (error) {
    console.error("Failed to generate license key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
