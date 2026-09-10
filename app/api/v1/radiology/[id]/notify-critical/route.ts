import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { RadiologyReportData } from "@/lib/radiology/report";
import { notifyModule } from "@/lib/notifications/notify";

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
    const { notifiedTo, method } = await req.json();
    if (!notifiedTo?.trim() || !method?.trim()) {
      return NextResponse.json({ error: "notifiedTo and method are required" }, { status: 400 });
    }

    const latestResult = await prisma.examResult.findFirst({
      where: { requestId: id, tenantId: session.user.tenantId },
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
      criticalCommunication: { notifiedTo: notifiedTo.trim(), method: method.trim(), notifiedAt: now.toISOString() },
    };

    const updated = await prisma.examResult.update({
      where: { id: latestResult.id },
      data: { criticalNotifiedAt: now, resultData: resultData as any },
    });

    const examRequest = await prisma.examRequest.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { examLabel: true, patient: { select: { firstName: true, lastName: true } } },
    });

    await notifyModule({
      tenantId: session.user.tenantId,
      moduleId: "MODULE_RADIOLOGY",
      action: "read",
      title: examRequest
        ? `Critical result — ${examRequest.examLabel} (${examRequest.patient.firstName} ${examRequest.patient.lastName})`
        : "Critical radiology result",
      body: `Notified to ${notifiedTo.trim()} via ${method.trim()}.`,
      link: "/radiology",
      resourceType: "exam_result",
      resourceId: latestResult.id,
      actorId: session.user.id,
      excludeUserId: session.user.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error notifying critical radiology result:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
