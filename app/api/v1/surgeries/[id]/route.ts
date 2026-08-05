import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findSurgeryConflicts } from "@/lib/surgery/conflicts";
import { requireModulePermission } from "@/lib/permissions";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const surgery = await prisma.surgicalProcedure.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { patient: { select: PATIENT_SELECT } },
  });

  if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
  return NextResponse.json(surgery);
}

// PATCH /api/v1/surgeries/[id]
// Reschedule/edit — only allowed while the case is still scheduled or postponed.
// Editing a postponed case re-activates it back to "scheduled".
// Body: { scheduledAt?, roomId?, surgeonId?, anesthesiologistId?, procedureLabel?,
//         procedureCode?, asaScore?, force? }
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
    const existing = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (existing.status !== "scheduled" && existing.status !== "postponed") {
      return NextResponse.json(
        { error: `Cannot edit a case with status "${existing.status}"` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      scheduledAt,
      roomId,
      surgeonId,
      anesthesiologistId,
      procedureLabel,
      procedureCode,
      asaScore,
      force,
    } = body;

    const nextSurgeonId = surgeonId ?? existing.surgeonId;
    const nextRoomId = roomId ?? existing.roomId;
    const nextScheduledAt = scheduledAt ? new Date(scheduledAt) : existing.scheduledAt;

    if (!force && nextScheduledAt) {
      const conflicts = await findSurgeryConflicts({
        surgeonId: nextSurgeonId,
        roomId: nextRoomId,
        scheduledAt: nextScheduledAt,
        excludeId: id,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const surgery = await prisma.surgicalProcedure.update({
      where: { id },
      data: {
        scheduledAt: nextScheduledAt,
        roomId: roomId !== undefined ? roomId || null : undefined,
        surgeonId: surgeonId ?? undefined,
        anesthesiologistId: anesthesiologistId !== undefined ? anesthesiologistId || null : undefined,
        procedureLabel: procedureLabel ?? undefined,
        procedureCode: procedureCode !== undefined ? procedureCode || null : undefined,
        asaScore: asaScore !== undefined ? (asaScore ? Number(asaScore) : null) : undefined,
        status: existing.status === "postponed" ? "scheduled" : undefined,
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    return NextResponse.json(surgery);
  } catch (error) {
    console.error("Error updating surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
