import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// GET /api/v1/appointments/availability?doctorId=&date=YYYY-MM-DD
// Combines the doctor's configured weekly availability windows with their already-booked
// appointments for that day, returning bookable slots with a busy flag — feeds the
// booking form's time picker.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_APPOINTMENTS", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const dateParam = searchParams.get("date");
  if (!doctorId || !dateParam) {
    return NextResponse.json({ error: "doctorId and date are required" }, { status: 400 });
  }

  const day = new Date(`${dateParam}T00:00:00`);
  const weekday = day.getDay();
  const dayStart = new Date(day);
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const [windows, bookedAppointments] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { tenantId: session.user.tenantId, doctorId, weekday },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId: session.user.tenantId,
        doctorId,
        status: { in: ["booked", "confirmed", "checked_in"] },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { scheduledAt: true, durationMinutes: true },
    }),
  ]);

  if (windows.length === 0) {
    return NextResponse.json({ data: [], hasConfiguredAvailability: false, success: true });
  }

  const slots: Array<{ time: string; busy: boolean }> = [];
  for (const window of windows) {
    const [startH, startM] = window.startTime.split(":").map(Number);
    const [endH, endM] = window.endTime.split(":").map(Number);
    let cursor = startH * 60 + startM;
    const end = endH * 60 + endM;

    while (cursor < end) {
      const slotStart = new Date(dayStart.getTime() + cursor * 60_000);
      const slotEnd = new Date(slotStart.getTime() + window.slotMinutes * 60_000);
      const busy = bookedAppointments.some((a) => {
        const bookedStart = a.scheduledAt;
        const bookedEnd = new Date(bookedStart.getTime() + a.durationMinutes * 60_000);
        return slotStart < bookedEnd && bookedStart < slotEnd;
      });
      slots.push({ time: slotStart.toISOString(), busy });
      cursor += window.slotMinutes;
    }
  }

  return NextResponse.json({ data: slots, hasConfiguredAvailability: true, success: true });
}
