import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { examImagingContext, RECENT_CREATININE_DAYS } from "@/lib/radiology/exam-context";

// GET /api/v1/radiology/[id]/pre-exam — what the safety check before this exam must cover
// (pregnancy, renal function, contrast allergy) and what MedCare already knows (allergies that
// match, latest creatinine).
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
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

  const now = new Date();
  const ctx = await examImagingContext(session.user.tenantId, exam, now);
  const creatinineIsOld = ctx.latestCreatinine ? now.getTime() - new Date(ctx.latestCreatinine.at).getTime() > RECENT_CREATININE_DAYS * 86_400_000 : false;
  return NextResponse.json({ ...ctx, creatinineIsOld });
}
