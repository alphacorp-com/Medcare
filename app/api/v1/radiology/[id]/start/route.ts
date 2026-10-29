import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";
import { examImagingContext } from "@/lib/radiology/exam-context";
import { parseSafetyCheck } from "@/lib/radiology/safety";

// PATCH /api/v1/radiology/[id]/start — patient has arrived, images are being acquired: scheduled -> in_progress
// Body: { pregnancy?: { status, justification? }, renal?: { assessed, creatinineUmolL?, egfr? },
//         contrastAllergyAcknowledged? } — the pre-exam safety check. Which answers are required
// is decided here from the patient and the exam (lib/radiology/safety), not by the browser.
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
  const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (exam.status !== "scheduled") {
    return NextResponse.json({ error: `Cannot start an exam with status "${exam.status}"` }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const now = new Date();
  const { requirements } = await examImagingContext(session.user.tenantId, exam, now);
  const check = parseSafetyCheck(body, requirements, { userId: session.user.id, at: now });
  if (!check.ok) return NextResponse.json({ error: check.error, requirements }, { status: 400 });

  const { count } = await prisma.examRequest.updateMany({
    where: { id, status: "scheduled" },
    data: { status: "in_progress", safetyCheck: check.value as unknown as Prisma.InputJsonValue },
  });
  if (count === 0) return NextResponse.json({ error: "The exam changed meanwhile, reload it" }, { status: 409 });

  await auditClinicalAction(session, req, "radiology.start", { type: "exam_request", id }, { safetyCheck: check.value });
  return NextResponse.json(await prisma.examRequest.findUnique({ where: { id } }));
}
