import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { ageInDaysAt } from "@/lib/patients/age";
import type { MalariaTestType, MalariaResult, MalariaSeverity } from "@prisma/client";

const TEST_TYPES: MalariaTestType[] = ["rdt", "microscopy", "clinical_only"];
const RESULTS: MalariaResult[] = ["pending", "positive", "negative"];
const SEVERITIES: MalariaSeverity[] = ["simple", "severe"];

// ── GET /api/v1/patients/:id/malaria-cases ───────────────────────────────────
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

    const cases = await prisma.malariaCase.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      orderBy: { diagnosedAt: "desc" },
    });

    return NextResponse.json({ data: cases, total: cases.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/malaria-cases]", error);
    return NextResponse.json({ error: "Failed to fetch malaria cases", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/patients/:id/malaria-cases ──────────────────────────────────
// Body: { testType, result?, severity?, isPregnantAtDiagnosis?, examResultId?,
//         diagnosedAt?, treatedWithAct?, treatmentDrugName?, treatedAt?, notes? }
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
      testType, result, severity, isPregnantAtDiagnosis, examResultId,
      diagnosedAt, treatedWithAct, treatmentDrugName, treatedAt, notes,
    } = body as {
      testType?: MalariaTestType; result?: MalariaResult; severity?: MalariaSeverity;
      isPregnantAtDiagnosis?: boolean; examResultId?: string; diagnosedAt?: string;
      treatedWithAct?: boolean; treatmentDrugName?: string; treatedAt?: string; notes?: string;
    };

    if (!testType || !TEST_TYPES.includes(testType)) {
      return NextResponse.json({ error: "A valid testType is required", success: false }, { status: 400 });
    }
    if (result && !RESULTS.includes(result)) {
      return NextResponse.json({ error: "Invalid result", success: false }, { status: 400 });
    }
    if (severity && !SEVERITIES.includes(severity)) {
      return NextResponse.json({ error: "Invalid severity", success: false }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, birthDate: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    if (examResultId) {
      const examResult = await prisma.examResult.findFirst({
        where: { id: examResultId, tenantId: session.user.tenantId, patientId: id },
        select: { id: true },
      });
      if (!examResult) {
        return NextResponse.json({ error: "Exam result not found for this patient", success: false }, { status: 404 });
      }
    }

    const eventDate = diagnosedAt ? new Date(diagnosedAt) : new Date();

    const malariaCase = await prisma.malariaCase.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: id,
        examResultId: examResultId || null,
        testType,
        result: result ?? "pending",
        severity: severity ?? null,
        isPregnantAtDiagnosis: isPregnantAtDiagnosis ?? false,
        ageInDaysAtDiagnosis: ageInDaysAt(patient.birthDate, eventDate),
        diagnosedAt: eventDate,
        diagnosedById: session.user.id,
        treatedWithAct: treatedWithAct ?? false,
        treatmentDrugName: treatmentDrugName || null,
        treatedAt: treatedAt ? new Date(treatedAt) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ data: malariaCase, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/malaria-cases]", error);
    return NextResponse.json({ error: "Failed to record malaria case", success: false }, { status: 500 });
  }
}
