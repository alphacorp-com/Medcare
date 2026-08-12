import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { RadiologyReportData } from "@/lib/radiology/report";

// POST /api/v1/radiology/[id]/report
// Body: { technique, findings, impression, priorStudyIds?, isCritical?, reportUrl? }
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
    const { technique, findings, impression, priorStudyIds, isCritical, reportUrl } = body as {
      technique?: string;
      findings?: string;
      impression?: string;
      priorStudyIds?: string[];
      isCritical?: boolean;
      reportUrl?: string;
    };

    if (!findings?.trim() || !impression?.trim()) {
      return NextResponse.json({ error: "Findings and impression are required" }, { status: 400 });
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
      findings: findings.trim(),
      impression: impression.trim(),
      priorStudyIds: priorStudyIds ?? [],
    };

    const result = await prisma.examResult.create({
      data: {
        tenantId: session.user.tenantId,
        requestId: id,
        patientId: exam.patientId,
        performerId: session.user.id,
        resultData: resultData as unknown as Prisma.InputJsonValue,
        isCritical: Boolean(isCritical),
        reportUrl: reportUrl?.trim() || null,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error entering radiology report:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
