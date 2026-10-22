import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";
import { recordScreeningFromLab, recordViralLoadFromLab } from "@/lib/hiv/lab-link";
import type { ResultData } from "@/lib/laboratory/results";

// PATCH /api/v1/laboratory/[id]/validate
// Requires an unvalidated result; publishes it and completes the exam request. For an exam
// whose catalog entry is a screening test (HIV, syphilis, HBsAg…), the validated result also
// feeds the program's screening register (lib/hiv/lab-link), in the same transaction.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Signing off (or sending back) results is the biologist's / radiologist's call,
  // not the technician's who entered them — see the "validate" module action.
  const permCheck = requireModulePermission(session, "MODULE_LAB", "validate");
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
    return NextResponse.json({ error: "No result is awaiting validation for this exam" }, { status: 400 });
  }

  const now = new Date();
  const tenantId = session.user.tenantId;
  const [catalogEntry, stay] = await Promise.all([
    tenantId
      ? prisma.examCatalogEntry.findFirst({ where: { tenantId, code: exam.examCode }, select: { screeningTestType: true, viralLoadProgram: true } })
      : null,
    exam.stayId ? prisma.stay.findFirst({ where: { id: exam.stayId, tenantId }, select: { type: true } }) : null,
  ]);

  const updatedExam = await prisma.$transaction(async (tx) => {
    const updated = await tx.examRequest.update({ where: { id }, data: { status: "completed", completedAt: now } });
    await tx.examResult.update({
      where: { id: pendingResult.id },
      data: { validatedAt: now, validatedBy: session.user.id },
    });
    const parameters = ((pendingResult.resultData ?? {}) as unknown as Partial<ResultData>).parameters ?? [];
    if (tenantId && catalogEntry?.viralLoadProgram) {
      // A viral load exam feeds the program's viral loads (lib/hiv/lab-link).
      await recordViralLoadFromLab(tx, {
        tenantId,
        examResultId: pendingResult.id,
        patientId: exam.patientId,
        program: catalogEntry.viralLoadProgram,
        sampledAt: pendingResult.createdAt,
        pregnancyId: exam.pregnancyId,
        parameters,
        validatedById: session.user.id,
      });
    }
    if (tenantId && catalogEntry?.screeningTestType) {
      await recordScreeningFromLab(tx, {
        tenantId,
        examResultId: pendingResult.id,
        patientId: exam.patientId,
        testType: catalogEntry.screeningTestType,
        testedAt: pendingResult.createdAt,
        pregnancyId: exam.pregnancyId,
        stayType: stay?.type ?? null,
        parameters,
        validatedById: session.user.id,
      });
    }
    return updated;
  });

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
