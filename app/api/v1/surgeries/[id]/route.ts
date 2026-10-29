import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findSurgeryConflicts } from "@/lib/surgery/conflicts";
import { checkSurgeryReferences, roomLabels } from "@/lib/surgery/references";
import { parseAsaScore, parseDate, parseOptionalText, parseRequiredText, SURGERY_TEXT_LIMITS } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const surgery = await prisma.surgicalProcedure.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { patient: { select: PATIENT_SELECT } },
  });

  if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
  const labels = await roomLabels(session.user.tenantId, [surgery.roomId]);
  return NextResponse.json({ ...surgery, roomLabel: surgery.roomId ? labels.get(surgery.roomId) ?? null : null });
}

// PATCH /api/v1/surgeries/[id]
// Reschedule/edit — only allowed while the case is still scheduled or postponed.
// Editing a postponed case re-activates it back to "scheduled".
// Body: { scheduledAt?, roomId?, surgeonId?, anesthesiologistId?, procedureLabel?,
//         procedureCode?, asaScore?, force? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (existing.status !== "scheduled" && existing.status !== "postponed") {
      return NextResponse.json(
        { error: `Cannot edit a case with status "${existing.status}"` },
        { status: 400 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const has = (key: string) => body[key] !== undefined;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    const scheduled = has("scheduledAt") ? parseDate(body.scheduledAt, "scheduledAt") : null;
    if (scheduled && !scheduled.ok) return NextResponse.json({ error: scheduled.error }, { status: 400 });
    const label = has("procedureLabel") ? parseRequiredText(body.procedureLabel, "procedureLabel", SURGERY_TEXT_LIMITS.procedureLabel) : null;
    if (label && !label.ok) return NextResponse.json({ error: label.error }, { status: 400 });
    const code = has("procedureCode") ? parseOptionalText(body.procedureCode, "procedureCode", SURGERY_TEXT_LIMITS.procedureCode) : null;
    if (code && !code.ok) return NextResponse.json({ error: code.error }, { status: 400 });
    const asa = has("asaScore") ? parseAsaScore(body.asaScore) : null;
    if (asa && !asa.ok) return NextResponse.json({ error: asa.error }, { status: 400 });
    if (has("surgeonId") && !str(body.surgeonId)) return NextResponse.json({ error: "surgeonId cannot be empty" }, { status: 400 });

    const refError = await checkSurgeryReferences(
      session.user.tenantId,
      {
        surgeonId: has("surgeonId") ? str(body.surgeonId)! : undefined,
        anesthesiologistId: has("anesthesiologistId") ? str(body.anesthesiologistId) : undefined,
        roomId: has("roomId") ? str(body.roomId) : undefined,
      },
      existing.patientId
    );
    if (refError) return NextResponse.json({ error: refError.error }, { status: refError.status });

    const nextSurgeonId = has("surgeonId") ? str(body.surgeonId)! : existing.surgeonId;
    const nextRoomId = has("roomId") ? str(body.roomId) : existing.roomId;
    const nextScheduledAt = scheduled?.ok ? scheduled.value : existing.scheduledAt;
    const force = body.force === true;

    if (!force && nextScheduledAt) {
      const conflicts = await findSurgeryConflicts({
        tenantId: session.user.tenantId,
        surgeonId: nextSurgeonId,
        roomId: nextRoomId,
        scheduledAt: nextScheduledAt,
        excludeId: id,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    // Conditional on the status read above: a case started or cancelled meanwhile is not edited.
    const { count } = await prisma.surgicalProcedure.updateMany({
      where: { id, status: existing.status },
      data: {
        scheduledAt: nextScheduledAt,
        roomId: nextRoomId,
        surgeonId: nextSurgeonId,
        anesthesiologistId: has("anesthesiologistId") ? str(body.anesthesiologistId) : undefined,
        procedureLabel: label?.ok ? label.value : undefined,
        procedureCode: code?.ok ? code.value : undefined,
        asaScore: asa?.ok ? asa.value : undefined,
        status: existing.status === "postponed" ? "scheduled" : undefined,
      },
    });
    if (count === 0) return NextResponse.json({ error: "The case changed meanwhile, reload it" }, { status: 409 });

    await auditClinicalAction(session, req, "surgery.update", { type: "surgical_procedure", id }, {
      previousStatus: existing.status,
      changed: Object.keys(body).filter((k) => k !== "force"),
      scheduledAt: nextScheduledAt?.toISOString() ?? null,
      forced: force,
    });
    const surgery = await prisma.surgicalProcedure.findUnique({ where: { id }, include: { patient: { select: PATIENT_SELECT } } });
    return NextResponse.json(surgery);
  } catch (error) {
    console.error("Error updating surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
