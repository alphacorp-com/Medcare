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
    const tenantId = String(body.tenantId || "");
    const planId = String(body.planId || "");
    const normalizedPeriod = normalizePeriod(String(body.period || ""));

    if (!tenantId || !planId || !normalizedPeriod) {
      return NextResponse.json(
        { error: "tenantId, planId and a valid period are required." },
        { status: 400 }
      );
    }

    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
      prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }),
    ]);

    if (!tenant || !plan) {
      return NextResponse.json({ error: "Tenant or plan not found." }, { status: 404 });
    }

    const rawKey = createLicenseKey();
    const keyHash = hashLicenseKey(rawKey);
    const keyPreview = `${rawKey.slice(0, 5)}-*****-*****-${rawKey.slice(-5)}`;

    await prisma.licenseKey.create({
      data: {
        tenantId,
        planId,
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
