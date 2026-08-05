import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/radiology/[id]/reject
// Body: { reason }
// Deletes the unvalidated draft report. Unlike Lab's reject, the exam stays
// "in_progress" rather than reverting to "requested" — the images already
// exist, only the interpretation is being redone.
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
    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to reject a report" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const pendingResult = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingResult) {
      return NextResponse.json({ error: "No report is awaiting validation for this exam" }, { status: 400 });
    }

    const [updatedExam] = await prisma.$transaction([
      prisma.examRequest.update({
        where: { id },
        data: { notes: exam.notes ? `${exam.notes}\n[Report rejected: ${reason}]` : `[Report rejected: ${reason}]` },
      }),
      prisma.examResult.delete({ where: { id: pendingResult.id } }),
    ]);

    return NextResponse.json(updatedExam);
  } catch (error) {
    console.error("Error rejecting radiology report:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
