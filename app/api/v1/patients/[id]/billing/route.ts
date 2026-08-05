import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/patients/:id/billing ───────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

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
