import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent audit activities (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit to 20 for dashboard
    });

    // For each activity, get user info based on actorType
    const auditData = await Promise.all(
      activities.map(async (activity) => {
        let user = null;

        if (activity.actorType === 'tenant_user') {
          // Get tenant user info
          user = await prisma.tenantUser.findUnique({
            where: { id: activity.actorId },
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          });
        } else if (activity.actorType === 'admin') {
          // Get admin user info
          user = await prisma.adminUser.findUnique({
            where: { id: activity.actorId },
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          });
        }

        return {
          id: activity.id,
          timestamp: activity.createdAt.toISOString(),
          user: user ? user.fullName : 'Unknown User',
          action: activity.action,
          resource: activity.resourceType || 'Unknown',
          details: activity.payload ? JSON.stringify(activity.payload) : 'No details',
          ipAddress: activity.ipAddress || 'Unknown',
          severity: (activity.payload as any)?.severity || 'low',
        };
      })
    );

    return NextResponse.json({
      data: auditData,
      total: auditData.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/dashboard/audit]", error);
    return NextResponse.json(
      { error: "Failed to fetch audit activities", success: false },
      { status: 500 }
    );
  }
}