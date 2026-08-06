import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// GET /api/v1/patients/:id/surgeries
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

    const surgeries = await prisma.surgicalProcedure.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      orderBy: { scheduledAt: "desc" },
    });

    return NextResponse.json({
      data: surgeries,
      total: surgeries.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/surgeries]", error);
    return NextResponse.json(
      { error: "Failed to fetch surgeries", success: false },
      { status: 500 }
    );
  }
}
