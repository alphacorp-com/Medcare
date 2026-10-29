import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";
import { notifyUser } from "@/lib/notifications/notify";

const MAX_TEXT = 8_000;

// POST /api/v1/radiology/[id]/addenda — Body: { text }
// Corrects or completes a VALIDATED report: appended, never edited; the validated text stays as
// it was published. A radiologist's act (the "validate" action). The prescriber is notified.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "validate");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "The addendum text is required" }, { status: 400 });
    if (text.length > MAX_TEXT) return NextResponse.json({ error: "The addendum is too long" }, { status: 413 });

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (exam.status !== "completed") return NextResponse.json({ error: "Only a validated report can receive an addendum" }, { status: 400 });

    const result = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: { not: null } },
      orderBy: { validatedAt: "desc" },
      select: { id: true },
    });
    if (!result) return NextResponse.json({ error: "No validated report for this exam" }, { status: 400 });

    const addendum = await prisma.examResultAddendum.create({
      data: { tenantId: session.user.tenantId, resultId: result.id, text, authorId: session.user.id },
    });

    await auditClinicalAction(session, req, "radiology.addendum", { type: "exam_request", id }, { resultId: result.id, addendumId: addendum.id });
    await notifyUser({
      tenantId: session.user.tenantId,
      recipientId: exam.prescriberId,
      moduleId: "MODULE_RADIOLOGY",
      title: `Addendum au compte rendu : ${exam.examLabel}`,
      body: text.slice(0, 200),
      link: `/patients/${exam.patientId}`,
      resourceType: "exam_result",
      resourceId: result.id,
      actorId: session.user.id,
    });
    return NextResponse.json(addendum, { status: 201 });
  } catch (error) {
    console.error("Error adding radiology addendum:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
