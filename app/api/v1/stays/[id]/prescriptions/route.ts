import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── POST /api/v1/stays/:id/prescriptions ────────────────────────────────────
// Body: { prescriberId, notes?, items: [{ drug, dosage, frequency, duration, instructions? }] }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id: stayId } = await params;
    const body = await request.json();

    const { prescriberId, notes, items } = body;

    if (!prescriberId) {
      return NextResponse.json(
        { error: "prescriberId is required", success: false },
        { status: 400 }
      );
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one prescription item is required", success: false },
        { status: 400 }
      );
    }

    // Fetch the stay to get patientId (scoped to this tenant)
    const stay = await prisma.stay.findFirst({
      where: { id: stayId, tenantId: session.user.tenantId },
      select: { id: true, patientId: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    const prescription = await prisma.prescription.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: stay.patientId,
        stayId: stay.id,
        prescriberId,
        notes: notes ?? null,
        items: items,
      },
    });

    return NextResponse.json({ data: prescription, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/stays/:id/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to create prescription", success: false },
      { status: 500 }
    );
  }
}

// ── GET /api/v1/stays/:id/prescriptions ─────────────────────────────────────
export async function GET(
  _request: Request,
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

    const { id: stayId } = await params;

    const stay = await prisma.stay.findFirst({
      where: { id: stayId, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { stayId, tenantId: session.user.tenantId },
      orderBy: { prescribedAt: "desc" },
    });

    return NextResponse.json({ data: prescriptions, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays/:id/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to fetch prescriptions", success: false },
      { status: 500 }
    );
  }
}
