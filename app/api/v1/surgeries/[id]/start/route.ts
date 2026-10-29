import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isPhaseComplete, WhoChecklist } from "@/lib/surgery/checklist";
import { startBlockers } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/surgeries/[id]/start
// Requires the Sign In and Time Out checklist phases and — except for an emergency — the
// informed consent and the pre-anaesthesia visit on record.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

  if (surgery.status !== "scheduled") {
    return NextResponse.json({ error: `Cannot start a case with status "${surgery.status}"` }, { status: 400 });
  }

  const checklist = (surgery.whoChecklist ?? {}) as WhoChecklist;

  if (!isPhaseComplete("signIn", checklist.signIn)) {
    return NextResponse.json({ error: "The Sign In checklist must be completed before starting" }, { status: 400 });
  }
  if (!isPhaseComplete("timeOut", checklist.timeOut)) {
    return NextResponse.json({ error: "The Time Out checklist must be completed before starting" }, { status: 400 });
  }
  const phases = { signIn: true, timeOut: true };
  if (startBlockers(surgery, phases).includes("consent")) {
    return NextResponse.json({ error: "The informed consent must be recorded before starting (or the case marked as an emergency)" }, { status: 400 });
  }
  if (startBlockers(surgery, phases).includes("preAnesthesia")) {
    return NextResponse.json({ error: "The pre-anaesthesia visit must be recorded before starting (or the case marked as an emergency)" }, { status: 400 });
  }

  // Row locked and re-checked: a checklist phase redone (unticked) meanwhile blocks the start.
  const started = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "tenant_template"."surgical_procedures" WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.surgicalProcedure.findUnique({
      where: { id },
      select: { status: true, whoChecklist: true, isEmergency: true, consentObtainedAt: true, preAnesthesiaAt: true },
    });
    if (!current || current.status !== "scheduled") return false;
    const done = (current.whoChecklist ?? {}) as WhoChecklist;
    if (startBlockers(current, { signIn: isPhaseComplete("signIn", done.signIn), timeOut: isPhaseComplete("timeOut", done.timeOut) }).length > 0) return false;
    await tx.surgicalProcedure.update({ where: { id }, data: { status: "in_progress", startedAt: new Date() } });
    return true;
  });
  if (!started) return NextResponse.json({ error: "The case changed meanwhile, reload it" }, { status: 409 });

  await auditClinicalAction(session, req, "surgery.start", { type: "surgical_procedure", id });
  return NextResponse.json(await prisma.surgicalProcedure.findUnique({ where: { id } }));
}
