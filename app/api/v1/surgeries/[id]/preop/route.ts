import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseOptionalText, parseRequiredText } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";

const MAX_NOTES = 8_000;

// PATCH /api/v1/surgeries/[id]/preop
// Body: { step: "consent", notes? } | { step: "preAnesthesia", notes }
// Records, before the intervention, that the patient's informed consent was obtained (by the
// user recording it) and the pre-anaesthesia visit (by a clinician, with its conclusions).
// Both are required to start a non-emergency case. Recorded once each: what was signed is not
// rewritten afterwards (the audit log keeps who and when).
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

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const step = body.step;
    if (step !== "consent" && step !== "preAnesthesia") {
      return NextResponse.json({ error: 'step must be "consent" or "preAnesthesia"' }, { status: 400 });
    }
    const notes = step === "consent" ? parseOptionalText(body.notes, "notes", MAX_NOTES) : parseRequiredText(body.notes, "notes", MAX_NOTES);
    if (!notes.ok) return NextResponse.json({ error: notes.error }, { status: 400 });

    const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
    if (surgery.status !== "scheduled" && surgery.status !== "postponed") {
      return NextResponse.json({ error: `Cannot record a pre-operative step for status "${surgery.status}"` }, { status: 400 });
    }

    if (step === "preAnesthesia") {
      // The pre-anaesthesia visit is a medical act: only an active clinician records it.
      const clinician = await prisma.tenantUser.findFirst({
        where: { id: session.user.id, tenantId: session.user.tenantId, isActive: true, role: { isClinicalProvider: true } },
        select: { id: true },
      });
      if (!clinician) return NextResponse.json({ error: "Only a clinician can record the pre-anaesthesia visit" }, { status: 403 });
    }

    const now = new Date();
    const { count } =
      step === "consent"
        ? await prisma.surgicalProcedure.updateMany({
            where: { id, consentObtainedAt: null, status: { in: ["scheduled", "postponed"] } },
            data: { consentObtainedAt: now, consentObtainedById: session.user.id, consentNotes: notes.value },
          })
        : await prisma.surgicalProcedure.updateMany({
            where: { id, preAnesthesiaAt: null, status: { in: ["scheduled", "postponed"] } },
            data: { preAnesthesiaAt: now, preAnesthesiaById: session.user.id, preAnesthesiaNotes: notes.value },
          });
    if (count === 0) return NextResponse.json({ error: "Already recorded, or the case changed meanwhile" }, { status: 409 });

    await auditClinicalAction(session, req, `surgery.${step === "consent" ? "consent" : "pre_anesthesia"}`, { type: "surgical_procedure", id }, { notes: notes.value });
    return NextResponse.json(await prisma.surgicalProcedure.findUnique({ where: { id } }));
  } catch (error) {
    console.error("Error recording pre-operative step:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
