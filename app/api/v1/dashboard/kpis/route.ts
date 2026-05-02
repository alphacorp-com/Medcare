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

    // Active consultations (stays that are in progress)
    const activeConsultations = await prisma.stay.count({
      where: {
        status: StayStatus.in_progress,
      },
    });

    // ER wait time - calculate average wait time for emergency stays
    const emergencyStays = await prisma.stay.findMany({
      where: {
        status: StayStatus.in_progress,
        type: "emergency",
      },
      select: {
        admissionDate: true,
        createdAt: true,
      },
    });

    const avgWaitTime = emergencyStays.length > 0
      ? Math.round(
          emergencyStays.reduce((acc, stay) => {
            const waitTime = stay.admissionDate.getTime() - stay.createdAt.getTime();
            return acc + (waitTime / (1000 * 60)); // Convert to minutes
          }, 0) / emergencyStays.length
        )
      : 0;

    // Lab processing - count pending lab exams
    const pendingLabs = await prisma.examRequest.count({
      where: {
        status: "requested",
        type: {
          in: ["biology", "pathology"],
        },
      },
    });

    // System monitor data - mock for now, could be real system metrics
    const systemStatus = {
      apiGateway: "stable",
      dbClusters: 99.9,
      storage: "normal",
    };

    // Calculate trends (comparing to yesterday - simplified)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayConsultations = await prisma.stay.count({
      where: {
        status: StayStatus.in_progress,
        createdAt: {
          gte: yesterday,
          lt: new Date(),
        },
      },
    });

    const consultationChange = activeConsultations > 0
      ? Math.round(((activeConsultations - yesterdayConsultations) / Math.max(activeConsultations, 1)) * 100)
      : 0;

    return NextResponse.json({
      activeConsultations,
      consultationChange,
      avgWaitTime,
      pendingLabs,
      systemStatus,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/dashboard/kpis]", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard KPIs", success: false },
      { status: 500 }
    );
  }
}