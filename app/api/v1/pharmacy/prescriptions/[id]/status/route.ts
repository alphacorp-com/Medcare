import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PrescriptionStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'validated', 'dispensed'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", success: false },
        { status: 400 }
      );
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        status: status as PrescriptionStatus,
        ...(status === 'validated' ? { validatedAt: new Date() } : {})
      }
    });

    return NextResponse.json({ data: prescription, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/prescriptions/[id]/status]", error);
    return NextResponse.json(
      { error: "Failed to update prescription status", success: false },
      { status: 500 }
    );
  }
}
