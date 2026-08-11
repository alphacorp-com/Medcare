import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { TbControlPoint, TbSputumResult, TbTreatmentOutcome } from "@prisma/client";

const CONTROL_POINTS: TbControlPoint[] = ["m2", "m3", "m5", "m6", "other"];
const SPUTUM_RESULTS: TbSputumResult[] = ["not_done", "negative", "positive"];
const OUTCOMES: TbTreatmentOutcome[] = [
  "on_treatment", "cured", "treatment_completed", "treatment_failed", "died", "lost_to_follow_up", "not_evaluated", "transferred_out",
];

// ── POST /api/v1/tb-cases/:id/follow-ups ─────────────────────────────────────
// Body: { controlPoint, sputumResult?, weightKg?, followUpDate?, outcomeRecorded?, notes? }
// If outcomeRecorded is provided, the parent TbCase.outcome/outcomeDate are
// updated in the same transaction.
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
    const { controlPoint, sputumResult, weightKg, followUpDate, outcomeRecorded, notes } = body as {
      controlPoint?: TbControlPoint; sputumResult?: TbSputumResult; weightKg?: number;
      followUpDate?: string; outcomeRecorded?: TbTreatmentOutcome; notes?: string;
    };

    if (!controlPoint || !CONTROL_POINTS.includes(controlPoint)) {
      return NextResponse.json({ error: "A valid controlPoint is required", success: false }, { status: 400 });
    }
    if (sputumResult && !SPUTUM_RESULTS.includes(sputumResult)) {
      return NextResponse.json({ error: "Invalid sputumResult", success: false }, { status: 400 });
    }
    if (outcomeRecorded && !OUTCOMES.includes(outcomeRecorded)) {
      return NextResponse.json({ error: "Invalid outcomeRecorded", success: false }, { status: 400 });
    }

    const tbCase = await prisma.tbCase.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!tbCase) {
      return NextResponse.json({ error: "TB case not found", success: false }, { status: 404 });
    }

    const eventDate = followUpDate ? new Date(followUpDate) : new Date();

    const followUp = await prisma.$transaction(async (tx) => {
      const created = await tx.tbFollowUp.create({
        data: {
          tenantId: session.user.tenantId,
          tbCaseId: id,
          followUpDate: eventDate,
          controlPoint,
          sputumResult: sputumResult ?? "not_done",
          weightKg: weightKg ?? null,
          outcomeRecorded: outcomeRecorded ?? null,
          recordedById: session.user.id,
          notes: notes || null,
        },
      });

      if (outcomeRecorded) {
        await tx.tbCase.update({
          where: { id },
          data: { outcome: outcomeRecorded, outcomeDate: eventDate },
        });
      }

      return created;
    });

    return NextResponse.json({ data: followUp, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/tb-cases/:id/follow-ups]", error);
    return NextResponse.json({ error: "Failed to record follow-up", success: false }, { status: 500 });
  }
}
