import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { removeUnpaidCharge } from "@/lib/billing/paymentGate";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";

const MAX_REASON = 1_000;

// PATCH /api/v1/radiology/[id]/cancel
// Body: { reason }
// Refused once a report is awaiting validation: the radiologist validates or rejects it first,
// so a written interpretation is never left orphaned on a cancelled exam.
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
    const { reason } = await req.json();
    const trimmed = typeof reason === "string" ? reason.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "A reason is required to cancel an exam" }, { status: 400 });
    }
    if (trimmed.length > MAX_REASON) {
      return NextResponse.json({ error: "The reason is too long" }, { status: 413 });
    }

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status === "completed" || exam.status === "cancelled") {
      return NextResponse.json({ error: `Cannot cancel an exam with status "${exam.status}"` }, { status: 400 });
    }
    const pending = await prisma.examResult.findFirst({ where: { requestId: id, validatedAt: null }, select: { id: true } });
    if (pending) {
      return NextResponse.json({ error: "A report is awaiting validation: validate or reject it before cancelling" }, { status: 400 });
    }

    const { count } = await prisma.examRequest.updateMany({
      where: { id, status: exam.status },
      data: {
        status: "cancelled",
        notes: exam.notes ? `${exam.notes}\n[Cancelled: ${trimmed}]` : `[Cancelled: ${trimmed}]`,
      },
    });
    if (count === 0) return NextResponse.json({ error: "The exam changed meanwhile, reload it" }, { status: 409 });
    await removeUnpaidCharge("exam", id);

    await auditClinicalAction(session, req, "radiology.cancel", { type: "exam_request", id }, { reason: trimmed, previousStatus: exam.status });
    return NextResponse.json(await prisma.examRequest.findUnique({ where: { id } }));
  } catch (error) {
    console.error("Error cancelling radiology exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
