import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";

const MAX_REASON = 1_000;

// PATCH /api/v1/radiology/[id]/reject
// Body: { reason }
// Removes the unvalidated draft report from the worklist. Unlike Lab's reject, the exam stays
// "in_progress" rather than reverting to "requested" — the images already exist, only the
// interpretation is being redone. The rejected draft itself (content, author, date) is kept in
// the audit log with the reason: nothing written about a patient disappears without a trace.
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

  try {
    const { reason } = await req.json();
    const trimmed = typeof reason === "string" ? reason.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "A reason is required to reject a report" }, { status: 400 });
    }
    if (trimmed.length > MAX_REASON) {
      return NextResponse.json({ error: "The reason is too long" }, { status: 413 });
    }

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const pendingResult = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingResult) {
      return NextResponse.json({ error: "No report is awaiting validation for this exam" }, { status: 400 });
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      // Conditional: a report validated meanwhile is never deleted.
      const removed = await tx.examResult.deleteMany({ where: { id: pendingResult.id, validatedAt: null } });
      if (removed.count === 0) return null;
      return tx.examRequest.update({
        where: { id },
        data: { notes: exam.notes ? `${exam.notes}\n[Report rejected: ${trimmed}]` : `[Report rejected: ${trimmed}]` },
      });
    });
    if (!updatedExam) return NextResponse.json({ error: "The report changed meanwhile, reload it" }, { status: 409 });

    await auditClinicalAction(session, req, "radiology.reject", { type: "exam_request", id }, {
      reason: trimmed,
      rejectedReport: {
        resultId: pendingResult.id,
        reportedBy: pendingResult.performerId,
        reportedAt: pendingResult.createdAt.toISOString(),
        resultData: pendingResult.resultData,
        isCritical: pendingResult.isCritical,
        reportUrl: pendingResult.reportUrl,
      },
    });
    return NextResponse.json(updatedExam);
  } catch (error) {
    console.error("Error rejecting radiology report:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
