import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── GET /api/v1/patients/:id/vitals ─────────────────────────────────────────
// Vital signs history for a patient, most recent first.
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
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const vitals = await prisma.vitalSigns.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      orderBy: { recordedAt: "desc" },
    });

    return NextResponse.json({ data: vitals, total: vitals.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/vitals]", error);
    return NextResponse.json({ error: "Failed to fetch vital signs", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/patients/:id/vitals ────────────────────────────────────────
// Body: { stayId?, bloodPressureSystolic?, bloodPressureDiastolic?, pulse?,
//         temperature?, weight?, height?, spo2? }
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

    const { id } = await params;
    const body = await request.json();

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const vitals = await prisma.vitalSigns.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: id,
        stayId: toUuid(body.stayId),
        recordedById: session.user.id,
        bloodPressureSystolic: toNumber(body.bloodPressureSystolic),
        bloodPressureDiastolic: toNumber(body.bloodPressureDiastolic),
        pulse: toNumber(body.pulse),
        temperature: toNumber(body.temperature),
        weight: toNumber(body.weight),
        height: toNumber(body.height),
        spo2: toNumber(body.spo2),
      },
    });

    return NextResponse.json({ data: vitals, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/vitals]", error);
    return NextResponse.json({ error: "Failed to record vital signs", success: false }, { status: 500 });
  }
}
