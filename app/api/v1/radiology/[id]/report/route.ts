import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { RadiologyReportData } from "@/lib/radiology/report";
import { computeIsCritical, type ResultParameter } from "@/lib/laboratory/results";

// POST /api/v1/radiology/[id]/report
// Body: { technique, findings?, impression, parameters?, priorStudyIds?, isCritical?, reportUrl? }
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
    const body = await req.json();
    const { technique, findings, impression, parameters, priorStudyIds, isCritical, reportUrl } = body as {
      technique?: string;
      parameters?: ResultParameter[];
      findings?: string;
      impression?: string;
      priorStudyIds?: string[];
      isCritical?: boolean;
      reportUrl?: string;
    };

    const structured = Array.isArray(parameters) ? parameters.filter((p) => p?.name?.trim() && p?.value?.trim()) : [];
    if (!impression?.trim() || (!findings?.trim() && structured.length === 0)) {
      return NextResponse.json({ error: "Findings (or structured parameters) and impression are required" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot enter a report for status "${exam.status}"` }, { status: 400 });
    }

    const existingUnvalidated = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: null },
    });
    if (existingUnvalidated) {
      return NextResponse.json({ error: "A report is already awaiting validation for this exam" }, { status: 400 });
    }

    const resultData: RadiologyReportData = {
      technique: technique?.trim() || "",
      findings: findings?.trim() || "",
      impression: impression.trim(),
      priorStudyIds: priorStudyIds ?? [],
      ...(structured.length > 0 ? { parameters: structured } : {}),
    };

    const result = await prisma.examResult.create({
      data: {
        tenantId: session.user.tenantId,
        requestId: id,
        patientId: exam.patientId,
        performerId: session.user.id,
        resultData: resultData as unknown as Prisma.InputJsonValue,
        isCritical: computeIsCritical(structured, isCritical),
        reportUrl: reportUrl?.trim() || null,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error entering radiology report:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
