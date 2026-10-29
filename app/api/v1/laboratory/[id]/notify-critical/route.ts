import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { examOfModuleWhere } from "@/lib/exams/find-exam";
import { notifyModule } from "@/lib/notifications/notify";

// PATCH /api/v1/laboratory/[id]/notify-critical
// Marks the latest critical result as having been phoned/communicated to the ordering clinician.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  const latestResult = await prisma.examResult.findFirst({
    // Only a result of a laboratory exam: the module permission does not cover radiology.
    where: { requestId: id, tenantId: session.user.tenantId, request: examOfModuleWhere(session.user.tenantId, "laboratory") },
    orderBy: { createdAt: "desc" },
  });

  if (!latestResult) {
    return NextResponse.json({ error: "No result found for this exam" }, { status: 404 });
  }
  if (!latestResult.isCritical) {
    return NextResponse.json({ error: "This result is not flagged as critical" }, { status: 400 });
  }
  if (latestResult.criticalNotifiedAt) {
    return NextResponse.json({ error: "This critical result was already notified" }, { status: 400 });
  }

  // Recorded once: a concurrent notification of the same result does not overwrite it.
  const { count } = await prisma.examResult.updateMany({
    where: { id: latestResult.id, criticalNotifiedAt: null },
    data: { criticalNotifiedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "This critical result was already notified" }, { status: 400 });
  }
  const updated = await prisma.examResult.findUnique({ where: { id: latestResult.id } });

  const examRequest = await prisma.examRequest.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { examLabel: true, patient: { select: { firstName: true, lastName: true } } },
  });

  await notifyModule({
    tenantId: session.user.tenantId,
    moduleId: "MODULE_LAB",
    action: "read",
    title: examRequest
      ? `Critical result — ${examRequest.examLabel} (${examRequest.patient.firstName} ${examRequest.patient.lastName})`
      : "Critical laboratory result",
    body: "This critical result has been communicated to the ordering clinician.",
    link: "/laboratory",
    resourceType: "exam_result",
    resourceId: latestResult.id,
    actorId: session.user.id,
    excludeUserId: session.user.id,
  });

  return NextResponse.json(updated);
}
