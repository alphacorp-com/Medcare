import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";
import { notifyUser } from "@/lib/notifications/notify";
import { getRadiologySettings } from "@/lib/radiology/settings";

// PATCH /api/v1/radiology/[id]/validate — publishes the pending report and completes the exam.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Signing off (or sending back) results is the biologist's / radiologist's call,
  // not the technician's who entered them — see the "validate" module action.
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "validate");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (exam.status !== "in_progress") {
    return NextResponse.json({ error: `Cannot validate an exam with status "${exam.status}"` }, { status: 400 });
  }

  const pendingResult = await prisma.examResult.findFirst({
    where: { requestId: id, validatedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!pendingResult) {
    return NextResponse.json({ error: "No report is awaiting validation for this exam" }, { status: 400 });
  }
  // Double reading, when the facility requires it: the author of a report does not validate it.
  if (pendingResult.performerId === session.user.id && (await getRadiologySettings(session.user.tenantId)).requireSecondReader) {
    return NextResponse.json({ error: "second_reader_required" }, { status: 403 });
  }

  const now = new Date();
  // Both conditional: a concurrent validation, rejection or cancellation leaves nothing to do.
  const updatedExam = await prisma.$transaction(async (tx) => {
    const result = await tx.examResult.updateMany({ where: { id: pendingResult.id, validatedAt: null }, data: { validatedAt: now, validatedBy: session.user.id } });
    if (result.count === 0) return null;
    const request = await tx.examRequest.updateMany({ where: { id, status: "in_progress" }, data: { status: "completed", completedAt: now } });
    if (request.count === 0) throw new Error("exam_changed");
    return tx.examRequest.findUnique({ where: { id } });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "exam_changed") return null;
    throw error;
  });
  if (!updatedExam) return NextResponse.json({ error: "The exam changed meanwhile, reload it" }, { status: 409 });

  const billing = session.user.tenantId
    ? await suggestInvoiceLine({
        tenantId: session.user.tenantId,
        patientId: exam.patientId,
        stayId: exam.stayId,
        sourceType: "exam",
        sourceId: exam.id,
        description: exam.examLabel,
        feeCode: exam.examCode,
        performedById: session.user.id,
      })
    : null;

  await auditClinicalAction(session, req, "radiology.validate", { type: "exam_request", id }, { resultId: pendingResult.id, reportedBy: pendingResult.performerId, isCritical: pendingResult.isCritical });
  // The ordering clinician learns that the report is out (a critical one is also flagged).
  await notifyUser({
    tenantId: session.user.tenantId,
    recipientId: exam.prescriberId,
    moduleId: "MODULE_RADIOLOGY",
    title: `${pendingResult.isCritical ? "⚠ Résultat critique — " : ""}Compte rendu disponible : ${exam.examLabel}`,
    link: `/patients/${exam.patientId}`,
    resourceType: "exam_result",
    resourceId: pendingResult.id,
    actorId: session.user.id,
  });

  return NextResponse.json({ ...updatedExam, billing });
}
