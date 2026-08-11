import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { ageInDaysAt } from "@/lib/patients/age";

// ── GET /api/v1/patients/:id/immunizations ──────────────────────────────────
// Immunization history for a patient, most recent first.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const immunizations = await prisma.immunization.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      orderBy: { administeredAt: "desc" },
    });

    return NextResponse.json({ data: immunizations, total: immunizations.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/immunizations]", error);
    return NextResponse.json({ error: "Failed to fetch immunizations", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/patients/:id/immunizations ─────────────────────────────────
// Body: { antigenCode, doseNumber?, administeredAt?, lotNumber?, expiryDate?,
//         isOutOfSchedule?, notes? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { antigenCode, doseNumber, administeredAt, lotNumber, expiryDate, isOutOfSchedule, notes } = body as {
      antigenCode?: string; doseNumber?: number; administeredAt?: string; lotNumber?: string;
      expiryDate?: string; isOutOfSchedule?: boolean; notes?: string;
    };

    if (!antigenCode) {
      return NextResponse.json({ error: "antigenCode is required", success: false }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, birthDate: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const antigen = await prisma.referenceCatalogItem.findFirst({
      where: { tenantId: session.user.tenantId, catalogType: "vaccine_antigen", code: antigenCode },
      select: { code: true, nameFr: true },
    });
    if (!antigen) {
      return NextResponse.json({ error: "Unknown antigen code", success: false }, { status: 400 });
    }

    const eventDate = administeredAt ? new Date(administeredAt) : new Date();

    const immunization = await prisma.immunization.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: id,
        antigenCode: antigen.code,
        antigenName: antigen.nameFr,
        doseNumber: doseNumber ?? 1,
        administeredAt: eventDate,
        administeredById: session.user.id,
        ageInDaysAtAdministration: ageInDaysAt(patient.birthDate, eventDate),
        lotNumber: lotNumber || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isOutOfSchedule: isOutOfSchedule ?? false,
        notes: notes || null,
      },
    });

    return NextResponse.json({ data: immunization, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/immunizations]", error);
    return NextResponse.json({ error: "Failed to record immunization", success: false }, { status: 500 });
  }
}
