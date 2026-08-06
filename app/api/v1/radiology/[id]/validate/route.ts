import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";

// PATCH /api/v1/radiology/[id]/validate — publishes the pending report and completes the exam.
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

  const exam = await prisma.examRequest.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const pendingResult = await prisma.examResult.findFirst({
    where: { requestId: id, validatedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!pendingResult) {
    return NextResponse.json({ error: "No report is awaiting validation for this exam" }, { status: 400 });
  }

  const now = new Date();

  const [updatedExam] = await prisma.$transaction([
    prisma.examRequest.update({ where: { id }, data: { status: "completed", completedAt: now } }),
    prisma.examResult.update({
      where: { id: pendingResult.id },
      data: { validatedAt: now, validatedBy: session.user.id },
    }),
  ]);

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

  return NextResponse.json({ ...updatedExam, billing });
}
