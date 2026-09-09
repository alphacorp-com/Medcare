import { BillingCycle, PlanTier, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrServiceAuth } from "@/lib/admin/service-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrServiceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        tier: true,
        billingCycle: true,
        basePrice: true,
        currency: true,
        maxUsers: true,
        maxBeds: true,
        isActive: true,
        isPublic: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminOrServiceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      tier,
      billingCycle,
      basePrice,
      currency = "XAF",
      maxUsers,
      maxBeds,
      sortOrder = 0,
      isActive = true,
      isPublic = true,
    } = body;

    if (!name || !tier || !billingCycle) {
      return NextResponse.json({ error: "name, tier and billingCycle are required" }, { status: 400 });
    }

    const created = await prisma.plan.create({
      data: {
        name,
        tier: tier as PlanTier,
        billingCycle: billingCycle as BillingCycle,
        basePrice: new Prisma.Decimal(basePrice || 0),
        currency,
        maxUsers: maxUsers ? Number(maxUsers) : null,
        maxBeds: maxBeds ? Number(maxBeds) : null,
        sortOrder: Number(sortOrder),
        isActive: Boolean(isActive),
        isPublic: Boolean(isPublic),
      },
    });

    return NextResponse.json({ plan: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
