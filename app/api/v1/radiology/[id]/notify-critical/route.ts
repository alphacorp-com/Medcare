import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { RadiologyReportData } from "@/lib/radiology/report";
import { notifyModule, notifyUser } from "@/lib/notifications/notify";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";

const MAX_FIELD = 200;

// PATCH /api/v1/radiology/[id]/notify-critical
// Body: { notifiedTo, method }
// Records the ACR-recommended who/how/when of a critical-finding communication,
// not just that it happened.
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

  try {
    const body = await req.json();
    const notifiedTo = typeof body?.notifiedTo === "string" ? body.notifiedTo.trim() : "";
    const method = typeof body?.method === "string" ? body.method.trim() : "";
    if (!notifiedTo || !method) {
      return NextResponse.json({ error: "notifiedTo and method are required" }, { status: 400 });
    }
    if (notifiedTo.length > MAX_FIELD || method.length > MAX_FIELD) {
      return NextResponse.json({ error: "notifiedTo / method are too long" }, { status: 413 });
    }

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const latestResult = await prisma.examResult.findFirst({
      where: { requestId: exam.id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestResult) {
      return NextResponse.json({ error: "No report found for this exam" }, { status: 404 });
    }
    if (!latestResult.isCritical) {
      return NextResponse.json({ error: "This report is not flagged as critical" }, { status: 400 });
    }
    if (latestResult.criticalNotifiedAt) {
      return NextResponse.json({ error: "This critical finding was already notified" }, { status: 400 });
    }

    const now = new Date();
    const existingData = (latestResult.resultData ?? {}) as unknown as RadiologyReportData;
    const resultData: RadiologyReportData = {
      ...existingData,
      criticalCommunication: { notifiedTo, method, notifiedAt: now.toISOString() },
    };

    // Recorded once: a concurrent notification of the same finding does not overwrite it.
    const { count } = await prisma.examResult.updateMany({
      where: { id: latestResult.id, criticalNotifiedAt: null },
      data: { criticalNotifiedAt: now, resultData: resultData as unknown as Prisma.InputJsonValue },
    });
    if (count === 0) return NextResponse.json({ error: "This critical finding was already notified" }, { status: 400 });

    const patient = await prisma.patient.findUnique({ where: { id: exam.patientId }, select: { firstName: true, lastName: true } });
    const title = `Critical result — ${exam.examLabel}${patient ? ` (${patient.firstName} ${patient.lastName})` : ""}`;

    await notifyModule({
      tenantId: session.user.tenantId,
      moduleId: "MODULE_RADIOLOGY",
      action: "read",
      title,
      body: `Notified to ${notifiedTo} via ${method}.`,
      link: "/radiology",
      resourceType: "exam_result",
      resourceId: latestResult.id,
      actorId: session.user.id,
      excludeUserId: session.user.id,
    });
    // The ordering clinician gets it in the app too, whoever was reached by phone.
    await notifyUser({
      tenantId: session.user.tenantId,
      recipientId: exam.prescriberId,
      moduleId: "MODULE_RADIOLOGY",
      title,
      body: `Notified to ${notifiedTo} via ${method}.`,
      link: `/patients/${exam.patientId}`,
      resourceType: "exam_result",
      resourceId: latestResult.id,
      actorId: session.user.id,
    });

    await auditClinicalAction(session, req, "radiology.notify_critical", { type: "exam_request", id }, { resultId: latestResult.id, notifiedTo, method });
    return NextResponse.json(await prisma.examResult.findUnique({ where: { id: latestResult.id } }));
  } catch (error) {
    console.error("Error notifying critical radiology result:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
