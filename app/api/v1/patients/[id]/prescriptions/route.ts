import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PrescriptionStatus } from "@prisma/client";

// ── GET /api/v1/patients/:id/prescriptions ────────────────────────────────────
// Query params:
//   status – optional PrescriptionStatus filter
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PrescriptionStatus | null;

    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId: id,
        ...(status ? { status } : {}),
      },
      orderBy: { prescribedAt: "desc" },
      include: {
        drugDispensings: {
          orderBy: { dispensedAt: "desc" },
          select: {
            id: true,
            drugName: true,
            quantity: true,
            unit: true,
            dispensedAt: true,
            administeredAt: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: prescriptions,
      total: prescriptions.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to fetch prescriptions", success: false },
      { status: 500 }
    );
  }
}
