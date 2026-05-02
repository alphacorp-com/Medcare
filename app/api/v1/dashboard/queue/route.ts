import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { StayStatus } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get active stays (in progress) with patient info
    const activeStays = await prisma.stay.findMany({
      where: {
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
        _count: false, // Remove this line
      },
      orderBy: {
        admissionDate: 'asc',
      },
      take: 10, // Limit to 10 for dashboard
    });

    // Get attending doctor info separately
    const queueData = await Promise.all(
      activeStays.map(async (stay) => {
        let attendingDoctor = null;
        if (stay.attendingDoctorId) {
          attendingDoctor = await prisma.tenantUser.findUnique({
            where: { id: stay.attendingDoctorId },
            select: {
              id: true,
              fullName: true,
              specialty: true,
            },
          });
        }

        return {
          id: stay.id,
          ipp: stay.patient.ipp,
          name: `${stay.patient.lastName} ${stay.patient.firstName}`,
          provider: attendingDoctor
            ? `Dr. ${attendingDoctor.fullName}`
            : 'Unassigned',
          timeIn: stay.admissionDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          waiting: Math.floor((Date.now() - stay.admissionDate.getTime()) / (1000 * 60)), // minutes
          status: 'active',
        };
      })
    );

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