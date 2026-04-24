import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/v1/patients/:id/billing ───────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const billingStays = await prisma.billingStay.findMany({
      where: {
        patientId: id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        stay: {
          select: {
            stayNumber: true,
            admissionDate: true,
            dischargeDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: billingStays,
      total: billingStays.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/billing]", error);
    return NextResponse.json(
      { error: "Failed to fetch billing information", success: false },
      { status: 500 }
    );
  }
}
