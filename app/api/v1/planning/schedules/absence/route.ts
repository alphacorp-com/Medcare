import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// POST /api/v1/planning/schedules/absence
// Body: { userId, from, to, reason }
// There's no separate Leave/Absence model — this marks the user's EXISTING
// shifts in the range as "absent". A day with nothing already assigned has
// nothing to mark absent, which is correct: the roster only reflects shifts
// that were actually planned.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  try {
    const { userId, from, to, reason } = await req.json();
    if (!userId || !from || !to || !reason?.trim()) {
      return NextResponse.json({ error: "userId, from, to and reason are required" }, { status: 400 });
    }

    const result = await prisma.schedule.updateMany({
      where: {
        tenantId: session.user.tenantId,
        userId,
        date: { gte: toDateOnly(from), lte: toDateOnly(to) },
        status: { notIn: ["absent", "replaced"] },
      },
      data: { status: "absent", notes: reason },
    });

    return NextResponse.json({ affected: result.count });
  } catch (error) {
    console.error("Error declaring absence:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
