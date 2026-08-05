import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PrescriptionStatus | null;

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId: id,
        tenantId: session.user.tenantId,
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
