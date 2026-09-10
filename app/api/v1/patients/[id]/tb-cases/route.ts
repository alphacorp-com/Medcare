import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { TbCaseType, TbClassification, TbHivStatus } from "@prisma/client";

const CASE_TYPES: TbCaseType[] = [
  "new_case", "relapse", "treatment_after_failure", "treatment_after_loss_to_follow_up", "transfer_in", "other",
];
const CLASSIFICATIONS: TbClassification[] = [
  "pulmonary_bacteriologically_confirmed", "pulmonary_clinically_diagnosed", "extrapulmonary",
];
const HIV_STATUSES: TbHivStatus[] = ["positive", "negative", "unknown"];

// ── GET /api/v1/patients/:id/tb-cases ────────────────────────────────────────
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

    const cases = await prisma.tbCase.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      include: { followUps: { orderBy: { followUpDate: "desc" } } },
      orderBy: { notificationDate: "desc" },
    });

    return NextResponse.json({ data: cases, total: cases.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/tb-cases]", error);
    return NextResponse.json({ error: "Failed to fetch TB cases", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/patients/:id/tb-cases ───────────────────────────────────────
// Body: { caseType, classification, hivStatus?, weightKgAtDiagnosis?,
//         confirmingExamResultId?, notificationDate?, treatmentRegimen?,
//         treatmentStartDate?, notes? }
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
    const {
      caseType, classification, hivStatus, weightKgAtDiagnosis, confirmingExamResultId,
      notificationDate, treatmentRegimen, treatmentStartDate, notes,
    } = body as {
      caseType?: TbCaseType; classification?: TbClassification; hivStatus?: TbHivStatus;
      weightKgAtDiagnosis?: number; confirmingExamResultId?: string; notificationDate?: string;
      treatmentRegimen?: string; treatmentStartDate?: string; notes?: string;
    };

    if (!caseType || !CASE_TYPES.includes(caseType)) {
      return NextResponse.json({ error: "A valid caseType is required", success: false }, { status: 400 });
    }
    if (!classification || !CLASSIFICATIONS.includes(classification)) {
      return NextResponse.json({ error: "A valid classification is required", success: false }, { status: 400 });
    }
    if (hivStatus && !HIV_STATUSES.includes(hivStatus)) {
      return NextResponse.json({ error: "Invalid hivStatus", success: false }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    if (confirmingExamResultId) {
      const examResult = await prisma.examResult.findFirst({
        where: { id: confirmingExamResultId, tenantId: session.user.tenantId, patientId: id },
        select: { id: true },
      });
      if (!examResult) {
        return NextResponse.json({ error: "Exam result not found for this patient", success: false }, { status: 404 });
      }
    }

    const tbCase = await prisma.tbCase.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: id,
        notificationDate: notificationDate ? new Date(notificationDate) : new Date(),
        caseType,
        classification,
        hivStatus: hivStatus ?? "unknown",
        weightKgAtDiagnosis: weightKgAtDiagnosis ?? null,
        confirmingExamResultId: confirmingExamResultId || null,
        treatmentRegimen: treatmentRegimen || null,
        treatmentStartDate: treatmentStartDate ? new Date(treatmentStartDate) : null,
        registeredById: session.user.id,
        notes: notes || null,
      },
    });

    return NextResponse.json({ data: tbCase, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/tb-cases]", error);
    return NextResponse.json({ error: "Failed to register TB case", success: false }, { status: 500 });
  }
}
