import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// GET /api/v1/settings/doctor-availability?doctorId= — list weekly availability windows.
// Readable by any authenticated tenant member (the booking form needs it), writes are
// tenant_admin only (see PUT).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");

  const windows = await prisma.doctorAvailability.findMany({
    where: { tenantId: session.user.tenantId, doctorId: doctorId ?? undefined },
    orderBy: [{ doctorId: "asc" }, { weekday: "asc" }],
  });

  return NextResponse.json({ data: windows, success: true });
}

// PUT /api/v1/settings/doctor-availability
// Body: { doctorId, windows: Array<{ weekday, startTime, endTime, slotMinutes }> }
// Replaces this doctor's entire weekly schedule with the given set (simplest correct
// semantics for a "here's my week" form, avoids partial-update ambiguity).
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { doctorId, windows } = body as {
      doctorId?: string;
      windows?: Array<{ weekday: number; startTime: string; endTime: string; slotMinutes?: number }>;
    };

    if (!doctorId || !Array.isArray(windows)) {
      return NextResponse.json({ error: "doctorId and windows are required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({ where: { tenantId: session.user.tenantId, doctorId } });
      if (windows.length === 0) return [];
      return Promise.all(
        windows.map((w) =>
          tx.doctorAvailability.create({
            data: {
              tenantId: session.user.tenantId,
              doctorId,
              weekday: w.weekday,
              startTime: w.startTime,
              endTime: w.endTime,
              slotMinutes: w.slotMinutes ?? 30,
            },
          })
        )
      );
    });

    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    console.error("[PUT /api/v1/settings/doctor-availability]", error);
    return NextResponse.json({ error: "Failed to save availability" }, { status: 400 });
  }
}
