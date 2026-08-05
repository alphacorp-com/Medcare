import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/stays/:id ───────────────────────────────────────────────────
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

    const stay = await prisma.stay.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            ipp: true,
            birthDate: true,
          },
        },
        medicalRecords: {
          orderBy: { createdAt: "desc" },
        },
        prescriptions: {
          orderBy: { prescribedAt: "desc" },
        },
        examRequests: {
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: stay, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays/:id]", error);
    return NextResponse.json(
      { error: "Failed to fetch stay", success: false },
      { status: 500 }
    );
  }
}

// ── PATCH /api/v1/stays/:id ─────────────────────────────────────────────────
// Body: { status?, dischargeDate?, dischargeSummary?, bedId?, departmentId?, attendingDoctorId? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      status,
      dischargeDate,
      dischargeSummary,
      bedId,
      departmentId,
      attendingDoctorId,
    } = body;

    const stay = await prisma.stay.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(dischargeDate !== undefined && { dischargeDate: dischargeDate ? new Date(dischargeDate) : null }),
        ...(dischargeSummary !== undefined && { dischargeSummary }),
        ...(bedId !== undefined && { bedId }),
        ...(departmentId !== undefined && { departmentId }),
        ...(attendingDoctorId !== undefined && { attendingDoctorId }),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            ipp: true,
          },
        },
      },
    });

    return NextResponse.json({ data: stay, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/stays/:id]", error);
    return NextResponse.json(
      { error: "Failed to update stay", success: false },
      { status: 500 }
    );
  }
}
