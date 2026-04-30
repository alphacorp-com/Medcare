import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const allowedStatuses = ['open', 'coded', 'validated', 'billed', 'paid', 'contested'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status update', success: false },
        { status: 400 }
      );
    }

    const updated = await prisma.billingStay.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/billing/[id]]", error);
    return NextResponse.json(
      { error: "Failed to update billing status", success: false },
      { status: 500 }
    );
  }
}
