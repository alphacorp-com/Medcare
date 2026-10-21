import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { StayStatus } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same data as GET /consultations (in-progress stays with patient identity), so the
    // same module gate applies — authentication alone would expose patient names/IPP
    // to every staff account.
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    // Get active stays (in progress) with patient info
    const activeStays = await prisma.stay.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: StayStatus.in_progress,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            ipp: true,
          },
        },
      },
      orderBy: {
        admissionDate: 'asc',
      },
      take: 10, // Limit to 10 for dashboard
    });

    // Attending doctors in one query for the whole queue (was one query per stay).
    const doctorIds = [...new Set(activeStays.map((stay) => stay.attendingDoctorId).filter((id): id is string => Boolean(id)))];
    const doctors = doctorIds.length
      ? await prisma.tenantUser.findMany({
          where: { id: { in: doctorIds }, tenantId: session.user.tenantId },
          select: { id: true, fullName: true },
        })
      : [];
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]));

    const queueData = activeStays.map((stay) => {
      const doctorName = stay.attendingDoctorId ? doctorNames.get(stay.attendingDoctorId) : undefined;
      return {
        id: stay.id,
        ipp: stay.patient.ipp,
        name: `${stay.patient.lastName} ${stay.patient.firstName}`,
        provider: doctorName ? `Dr. ${doctorName}` : 'Unassigned',
        timeIn: stay.admissionDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        waiting: Math.floor((Date.now() - (stay.triagedAt ?? stay.admissionDate).getTime()) / (1000 * 60)), // minutes
        status: 'active',
        type: stay.type,
        triageAcuity: stay.triageAcuity,
      };
    });

    return NextResponse.json({
      data: queueData,
      total: queueData.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/dashboard/queue]", error);
    return NextResponse.json(
      { error: "Failed to fetch patient queue", success: false },
      { status: 500 }
    );
  }
}