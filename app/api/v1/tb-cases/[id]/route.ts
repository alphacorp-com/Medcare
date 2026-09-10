import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { TbCaseType, TbClassification, TbHivStatus, TbTreatmentOutcome } from "@prisma/client";

const CASE_TYPES: TbCaseType[] = [
  "new_case", "relapse", "treatment_after_failure", "treatment_after_loss_to_follow_up", "transfer_in", "other",
];
const CLASSIFICATIONS: TbClassification[] = [
  "pulmonary_bacteriologically_confirmed", "pulmonary_clinically_diagnosed", "extrapulmonary",
];
const HIV_STATUSES: TbHivStatus[] = ["positive", "negative", "unknown"];
const OUTCOMES: TbTreatmentOutcome[] = [
  "on_treatment", "cured", "treatment_completed", "treatment_failed", "died", "lost_to_follow_up", "not_evaluated", "transferred_out",
];

// ── GET /api/v1/tb-cases/:id ─────────────────────────────────────────────────
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
    const tbCase = await prisma.tbCase.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, ipp: true } },
        followUps: { orderBy: { followUpDate: "desc" } },
      },
    });
    if (!tbCase) {
      return NextResponse.json({ error: "TB case not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: tbCase, success: true });
  } catch (error) {
    console.error("[GET /api/v1/tb-cases/:id]", error);
    return NextResponse.json({ error: "Failed to fetch TB case", success: false }, { status: 500 });
  }
}

// ── PATCH /api/v1/tb-cases/:id ───────────────────────────────────────────────
// Body: { caseType?, classification?, hivStatus?, weightKgAtDiagnosis?,
//         treatmentRegimen?, treatmentStartDate?, outcome?, outcomeDate?, notes? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const existing = await prisma.tbCase.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) {
      return NextResponse.json({ error: "TB case not found", success: false }, { status: 404 });
    }

    const body = await request.json();
    const {
      caseType, classification, hivStatus, weightKgAtDiagnosis,
      treatmentRegimen, treatmentStartDate, outcome, outcomeDate, notes,
    } = body as {
      caseType?: TbCaseType; classification?: TbClassification; hivStatus?: TbHivStatus;
      weightKgAtDiagnosis?: number | null; treatmentRegimen?: string | null; treatmentStartDate?: string | null;
      outcome?: TbTreatmentOutcome; outcomeDate?: string | null; notes?: string | null;
    };

    if (caseType !== undefined && !CASE_TYPES.includes(caseType)) {
      return NextResponse.json({ error: "Invalid caseType", success: false }, { status: 400 });
    }
    if (classification !== undefined && !CLASSIFICATIONS.includes(classification)) {
      return NextResponse.json({ error: "Invalid classification", success: false }, { status: 400 });
    }
    if (hivStatus !== undefined && !HIV_STATUSES.includes(hivStatus)) {
      return NextResponse.json({ error: "Invalid hivStatus", success: false }, { status: 400 });
    }
    if (outcome !== undefined && !OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome", success: false }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (caseType !== undefined) data.caseType = caseType;
    if (classification !== undefined) data.classification = classification;
    if (hivStatus !== undefined) data.hivStatus = hivStatus;
    if (weightKgAtDiagnosis !== undefined) data.weightKgAtDiagnosis = weightKgAtDiagnosis;
    if (treatmentRegimen !== undefined) data.treatmentRegimen = treatmentRegimen;
    if (treatmentStartDate !== undefined) data.treatmentStartDate = treatmentStartDate ? new Date(treatmentStartDate) : null;
    if (outcome !== undefined) data.outcome = outcome;
    if (outcomeDate !== undefined) data.outcomeDate = outcomeDate ? new Date(outcomeDate) : null;
    if (notes !== undefined) data.notes = notes;

    const tbCase = await prisma.tbCase.update({ where: { id }, data });
    return NextResponse.json({ data: tbCase, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/tb-cases/:id]", error);
    return NextResponse.json({ error: "Failed to update TB case", success: false }, { status: 500 });
  }
}
