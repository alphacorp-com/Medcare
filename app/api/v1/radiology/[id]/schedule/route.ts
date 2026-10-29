import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireModulePermission } from "@/lib/permissions";
import { findRadiologyConflicts } from "@/lib/radiology/conflicts";
import { DEFAULT_EXAM_DURATION_MINUTES, findDeviceConflicts } from "@/lib/radiology/devices";
import { newAccessionNumber } from "@/lib/radiology/safety";
import { parseDuration } from "@/lib/surgery/validation";
import { findExamOfModule } from "@/lib/exams/find-exam";
import { auditClinicalAction } from "@/lib/exams/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/v1/radiology/[id]/schedule
// Body: { scheduledAt, deviceId?, expectedDurationMinutes?, force? }
// Books the exam on a device (if given) without overlapping another exam of that device, and
// gives it its DICOM accession number (kept if it already has one).
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
    const body = (await req.json()) as Record<string, unknown>;
    const scheduledDate = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "scheduledAt must be a valid date" }, { status: 400 });
    }
    const duration = parseDuration(body.expectedDurationMinutes, { min: 5, max: 480 });
    if (!duration.ok) return NextResponse.json({ error: duration.error }, { status: 400 });
    const deviceId = typeof body.deviceId === "string" && body.deviceId ? body.deviceId : null;
    if (deviceId && !UUID.test(deviceId)) return NextResponse.json({ error: "deviceId is not a valid id" }, { status: 400 });
    const force = body.force === true;

    const exam = await findExamOfModule(id, session.user.tenantId, "radiology");
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status === "awaiting_payment") {
      return NextResponse.json(
        { error: "This exam has not been paid yet — the patient must settle it at the cashier first / Cet examen n'est pas encore payé — le patient doit d'abord le régler à la caisse" },
        { status: 402 }
      );
    }
    if (exam.status !== "requested") {
      return NextResponse.json({ error: `Cannot schedule an exam with status "${exam.status}"` }, { status: 400 });
    }
    if (deviceId) {
      const device = await prisma.imagingDevice.findFirst({ where: { id: deviceId, tenantId: session.user.tenantId, isActive: true }, select: { id: true } });
      if (!device) return NextResponse.json({ error: "Imaging device not found" }, { status: 404 });
    }

    if (!force) {
      const conflicts = [
        ...(await findRadiologyConflicts(exam.patientId, scheduledDate, id)).map((c) => ({ ...c, resource: "patient" as const })),
        ...(deviceId
          ? (await findDeviceConflicts(session.user.tenantId, deviceId, scheduledDate, duration.value ?? DEFAULT_EXAM_DURATION_MINUTES, id)).map((c) => ({ ...c, resource: "device" as const }))
          : []),
      ];
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    // Only from "requested": a concurrent payment reversal or cancellation wins. The accession
    // number is unique per facility: a rare collision is retried with a new one.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { count } = await prisma.examRequest.updateMany({
          where: { id, status: "requested" },
          data: {
            status: "scheduled",
            scheduledAt: scheduledDate,
            deviceId,
            expectedDurationMinutes: duration.value,
            accessionNumber: exam.accessionNumber ?? newAccessionNumber(new Date()),
          },
        });
        if (count === 0) return NextResponse.json({ error: "The exam changed meanwhile, reload it" }, { status: 409 });
        break;
      } catch (error) {
        const unique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!unique || attempt === 2) throw error;
      }
    }

    await auditClinicalAction(session, req, "radiology.schedule", { type: "exam_request", id }, {
      scheduledAt: scheduledDate.toISOString(),
      deviceId,
      expectedDurationMinutes: duration.value,
      forced: force,
    });
    return NextResponse.json(await prisma.examRequest.findUnique({ where: { id } }));
  } catch (error) {
    console.error("Error scheduling radiology exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
