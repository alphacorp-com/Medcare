import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// Most recent diagnoses shown in the patient record; older ones stay on each stay.
const MAX_DIAGNOSES = 100;

// ── GET /api/v1/patients/:id/diagnoses ──────────────────────────────────────
// Coded (ICD-10) diagnoses of a patient — consultation, discharge and cause of death —
// most recent first.
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
    const tenantId = session.user.tenantId;

    const patient = await prisma.patient.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const diagnoses = await prisma.diagnosis.findMany({
      where: { patientId: id, tenantId },
      orderBy: { recordedAt: "desc" },
      take: MAX_DIAGNOSES,
      select: { id: true, icd10Code: true, label: true, kind: true, context: true, isNewCase: true, isSuspected: true, recordedAt: true, stayId: true },
    });

    return NextResponse.json({ data: diagnoses, total: diagnoses.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/diagnoses]", error);
    return NextResponse.json({ error: "Failed to fetch diagnoses", success: false }, { status: 500 });
  }
}
