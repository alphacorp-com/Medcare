import { SubscriptionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { planId, status, currentPeriodStart, currentPeriodEnd, cancelReason } = body;

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        planId,
        status: status as SubscriptionStatus,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
        cancelledAt: status === "cancelled" ? new Date() : null,
        cancelReason: status === "cancelled" ? cancelReason || null : null,
      },
    });

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error("Failed to update subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
