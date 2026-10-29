import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { RadiologyReportData } from "@/lib/radiology/report";
import { computeIsCritical, type ResultParameter } from "@/lib/laboratory/results";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";
import { safeExternalUrl } from "@/lib/safe-url";
import { parseRadiationDose } from "@/lib/radiology/safety";

// Upper bounds of a report (a free-text field is never unbounded).
const MAX = { technique: 4_000, findings: 30_000, impression: 8_000, parameters: 200, parameterText: 500, priorStudies: 20 };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// POST /api/v1/radiology/[id]/report
// Body: { technique, findings?, impression, parameters?, priorStudyIds?, isCritical?, reportUrl?,
//         radiationDose?: { dapMgyCm2?, ctdiVolMgy?, dlpMgyCm?, fluoroscopySeconds? } }
// findings may be left empty when the structured parameters (organ by organ) carry them.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
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
    const body = (await req.json()) as Record<string, unknown>;
    const technique = text(body.technique);
    const findings = text(body.findings);
    const impression = text(body.impression);
    const rawParameters = Array.isArray(body.parameters) ? (body.parameters as ResultParameter[]) : [];
    const structured = rawParameters.filter((p) => text(p?.name) && text(p?.value));

    if (!technique || !impression || (!findings && structured.length === 0)) {
      return NextResponse.json({ error: "Technique, impression and findings (or structured parameters) are required" }, { status: 400 });
    }
    if (
      technique.length > MAX.technique ||
      findings.length > MAX.findings ||
      impression.length > MAX.impression ||
      structured.length > MAX.parameters ||
      structured.some((p) => [p.name, p.value, p.unit, p.referenceRange].some((v) => typeof v === "string" && v.length > MAX.parameterText))
    ) {
      return NextResponse.json({ error: "The report is too long" }, { status: 413 });
    }

    const dose = parseRadiationDose(body.radiationDose);
    if (!dose.ok) return NextResponse.json({ error: dose.error }, { status: 400 });

    // A link to the images is optional, but only a plain http(s) URL is stored (never javascript:…).
    const rawUrl = text(body.reportUrl);
    const reportUrl = rawUrl ? safeExternalUrl(rawUrl) : null;
    if (rawUrl && !reportUrl) {
      return NextResponse.json({ error: "The report / images link must be an http(s) URL" }, { status: 400 });
    }

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot enter a report for status "${exam.status}"` }, { status: 400 });
    }

    // Prior studies: only this patient's other radiology exams of the tenant.
    const requestedPriors = Array.isArray(body.priorStudyIds) ? (body.priorStudyIds as unknown[]).filter((v): v is string => typeof v === "string").slice(0, MAX.priorStudies) : [];
    const priorStudyIds = requestedPriors.length
      ? (
          await prisma.examRequest.findMany({
            where: { id: { in: requestedPriors, not: id }, tenantId: session.user.tenantId, patientId: exam.patientId, type: "radiology" },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [];

    const resultData: RadiologyReportData = {
      technique,
      findings,
      impression,
      priorStudyIds,
      ...(structured.length > 0 ? { parameters: structured } : {}),
      ...(dose.value ? { radiationDose: dose.value } : {}),
    };

    // One pending report per exam: the exam row is locked while checking, so two concurrent
    // submissions cannot both pass the check.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "tenant_template"."exam_requests" WHERE id = ${id}::uuid FOR UPDATE`;
      const pending = await tx.examResult.findFirst({ where: { requestId: id, validatedAt: null }, select: { id: true } });
      if (pending) return null;
      return tx.examResult.create({
        data: {
          tenantId: session.user.tenantId,
          requestId: id,
          patientId: exam.patientId,
          performerId: session.user.id,
          resultData: resultData as unknown as Prisma.InputJsonValue,
          isCritical: computeIsCritical(structured, body.isCritical === true),
          reportUrl,
        },
      });
    });
    if (!result) {
      return NextResponse.json({ error: "A report is already awaiting validation for this exam" }, { status: 400 });
    }

    await auditClinicalAction(session, req, "radiology.report", { type: "exam_request", id }, { resultId: result.id, isCritical: result.isCritical });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error entering radiology report:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
