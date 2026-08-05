import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/laboratory/[id]/reject
// Body: { reason }
// An unvalidated result was never part of the official record, so rejecting deletes
// the draft ExamResult and reverts the request to "requested" for re-collection.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const { reason } = await req.json();
    if (!reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to reject a result" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findUnique({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const pendingResult = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingResult) {
      return NextResponse.json({ error: "No result is awaiting validation for this exam" }, { status: 400 });
    }

    const [updatedExam] = await prisma.$transaction([
      prisma.examRequest.update({
        where: { id },
        data: {
          status: "requested",
          notes: exam.notes ? `${exam.notes}\n[Rejected: ${reason}]` : `[Rejected: ${reason}]`,
        },
      }),
      prisma.examResult.delete({ where: { id: pendingResult.id } }),
    ]);

    return NextResponse.json(updatedExam);
  } catch (error) {
    console.error("Error rejecting lab result:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
