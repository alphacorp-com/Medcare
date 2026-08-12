import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findScheduleConflicts } from "@/lib/planning/conflicts";
import { shiftTimeRange } from "@/lib/planning/shifts";
import { requireModulePermission, requireTenantAdmin } from "@/lib/permissions";
import { Prisma, type ShiftType } from "@prisma/client";

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// ── GET /api/v1/planning/schedules ──────────────────────────────────────────
// Query params: departmentId (required), from, to (YYYY-MM-DD, inclusive)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_PLANNING", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!departmentId) {
    return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      tenantId: session.user.tenantId,
      departmentId,
      date: from || to ? { gte: from ? toDateOnly(from) : undefined, lte: to ? toDateOnly(to) : undefined } : undefined,
    },
    orderBy: [{ date: "asc" }],
  });

  return NextResponse.json(schedules);
}

// ── POST /api/v1/planning/schedules ─────────────────────────────────────────
// Body: { userId, departmentId, shiftType, date, notes?, force? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { userId, departmentId, shiftType, date, notes, force } = body as {
      userId?: string;
      departmentId?: string;
      shiftType?: ShiftType;
      date?: string;
      notes?: string;
      force?: boolean;
    };

    if (!userId || !departmentId || !shiftType || !date) {
      return NextResponse.json({ error: "userId, departmentId, shiftType and date are required" }, { status: 400 });
    }

    const scheduleDate = toDateOnly(date);

    if (!force) {
      const conflicts = await findScheduleConflicts(userId, scheduleDate);
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const { startTime, endTime } = shiftTimeRange(shiftType);

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: session.user.tenantId,
        userId,
        departmentId,
        shiftType,
        date: scheduleDate,
        startTime,
        endTime,
        notes: notes || null,
        status: "planned",
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This staff member already has that shift type on this date" },
        { status: 409 }
      );
    }
    console.error("Error creating schedule:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
