import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { findRadiologyConflicts } from "@/lib/radiology/conflicts";

// PATCH /api/v1/radiology/[id]/schedule
// Body: { scheduledAt, force? }
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
    const { scheduledAt, force } = await req.json();
    if (!scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findUnique({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status !== "requested") {
      return NextResponse.json({ error: `Cannot schedule an exam with status "${exam.status}"` }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledAt);

    if (!force) {
      const conflicts = await findRadiologyConflicts(exam.patientId, scheduledDate, id);
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const updated = await prisma.examRequest.update({
      where: { id },
      data: { status: "scheduled", scheduledAt: scheduledDate },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error scheduling radiology exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
