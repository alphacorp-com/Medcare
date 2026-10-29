import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { findRadiologyConflicts } from "@/lib/radiology/conflicts";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";

// PATCH /api/v1/radiology/[id]/schedule
// Body: { scheduledAt, force? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const { scheduledAt, force } = await req.json();
    const scheduledDate = typeof scheduledAt === "string" ? new Date(scheduledAt) : null;
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "scheduledAt must be a valid date" }, { status: 400 });
    }

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status === "awaiting_payment") {
      return NextResponse.json(
        { error: "This exam has not been paid yet — the patient must settle it at the cashier first / Cet examen n'est pas encore payé — le patient doit d'abord le régler à la caisse" },
        { status: 402 }
      );
    }
    if (exam.status !== "requested") {
      return NextResponse.json({ error: `Cannot schedule an exam with status "${exam.status}"` }, { status: 400 });
    }

    if (force !== true) {
      const conflicts = await findRadiologyConflicts(exam.patientId, scheduledDate, id);
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    // Only from "requested": a concurrent payment reversal or cancellation wins.
    const { count } = await prisma.examRequest.updateMany({
      where: { id, status: "requested" },
      data: { status: "scheduled", scheduledAt: scheduledDate },
    });
    if (count === 0) return NextResponse.json({ error: "The exam changed meanwhile, reload it" }, { status: 409 });

    await auditClinicalAction(session, req, "radiology.schedule", { type: "exam_request", id }, { scheduledAt: scheduledDate.toISOString(), forced: force === true });
    return NextResponse.json(await prisma.examRequest.findUnique({ where: { id } }));
  } catch (error) {
    console.error("Error scheduling radiology exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
