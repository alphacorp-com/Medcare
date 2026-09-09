import { BillingCycle, PlanTier, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrServiceAuth } from "@/lib/admin/service-auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminOrServiceAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
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

    const updated = await prisma.plan.update({
      where: { id },
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

    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("Failed to update plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
