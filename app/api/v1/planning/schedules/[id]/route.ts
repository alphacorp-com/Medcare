import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { ScheduleStatus } from "@prisma/client";

const ALLOWED_STATUSES: ScheduleStatus[] = ["planned", "confirmed", "modified", "absent", "replaced"];

// PATCH /api/v1/planning/schedules/[id]
// Body: { status?, notes? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { status, notes } = body as { status?: ScheduleStatus; notes?: string };

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        status: status ?? undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json(schedule);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    console.error("Error updating schedule:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

// DELETE /api/v1/planning/schedules/[id] — removes a mistakenly-assigned shift
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    console.error("Error deleting schedule:", error);
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
  }
}
