import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isPhaseComplete, WhoChecklist } from "@/lib/surgery/checklist";
import { parseComplications, parseOptionalText, parseRequiredText, SURGERY_TEXT_LIMITS } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";

function slugifyProcedure(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// PATCH /api/v1/surgeries/[id]/complete
// Body: { surgicalReport, anesthesiaReport?, complications? }
// Requires the Sign Out checklist phase to be complete and a non-empty report. The operative
// report is signed: only the operating surgeon of the case completes it.
// If the case is linked to a Stay, also files a signed "surgery_report" MedicalRecord.
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
    const report = parseRequiredText(body.surgicalReport, "surgicalReport", SURGERY_TEXT_LIMITS.surgicalReport);
    if (!report.ok) {
      return NextResponse.json({ error: report.error === "surgicalReport is required" ? "A surgical report is required to complete the case" : report.error }, { status: 400 });
    }
    const anesthesia = parseOptionalText(body.anesthesiaReport, "anesthesiaReport", SURGERY_TEXT_LIMITS.anesthesiaReport);
    if (!anesthesia.ok) return NextResponse.json({ error: anesthesia.error }, { status: 400 });
    const complications = parseComplications(body.complications);
    if (!complications.ok) return NextResponse.json({ error: complications.error }, { status: 400 });

    const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (surgery.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot complete a case with status "${surgery.status}"` }, { status: 400 });
    }
    if (surgery.surgeonId !== session.user.id) {
      return NextResponse.json({ error: "Only the operating surgeon can sign the operative report" }, { status: 403 });
    }

    const checklist = (surgery.whoChecklist ?? {}) as WhoChecklist;
    if (!isPhaseComplete("signOut", checklist.signOut)) {
      return NextResponse.json({ error: "The Sign Out checklist must be completed before finishing" }, { status: 400 });
    }

    const endedAt = new Date();

    // Conditional on "in_progress": a second click or a concurrent completion files nothing twice.
    const completed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.surgicalProcedure.updateMany({
        where: { id, status: "in_progress" },
        data: {
          status: "completed",
          endedAt,
          surgicalReport: report.value,
          anesthesiaReport: anesthesia.value,
          complications: complications.value,
        },
      });
      if (count === 0) return false;
      if (surgery.stayId) {
        await tx.medicalRecord.create({
          data: {
            tenantId: session.user.tenantId,
            patientId: surgery.patientId,
            stayId: surgery.stayId,
            authorId: session.user.id,
            type: "surgery_report",
            title: surgery.procedureLabel,
            content: report.value,
            isSigned: true,
            signedAt: endedAt,
            signedBy: session.user.id,
          },
        });
      }
      return true;
    });
    if (!completed) return NextResponse.json({ error: "The case changed meanwhile, reload it" }, { status: 409 });

    const billing = session.user.tenantId
      ? await suggestInvoiceLine({
          tenantId: session.user.tenantId,
          patientId: surgery.patientId,
          stayId: surgery.stayId,
          sourceType: "surgery",
          sourceId: surgery.id,
          description: surgery.procedureLabel,
          feeCode: surgery.procedureCode ?? slugifyProcedure(surgery.procedureLabel),
          performedById: session.user.id,
        })
      : null;

    await auditClinicalAction(session, req, "surgery.complete", { type: "surgical_procedure", id }, { complications: complications.value, reportFiled: Boolean(surgery.stayId) });
    const updated = await prisma.surgicalProcedure.findUnique({ where: { id } });
    return NextResponse.json({ ...updated, billing });
  } catch (error) {
    console.error("Error completing surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
