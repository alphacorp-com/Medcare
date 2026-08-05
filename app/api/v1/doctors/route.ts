import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ── GET /api/v1/doctors ─────────────────────────────────────────────────────
// Returns all active doctors (TenantUser with role=doctor) for use in dropdowns.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doctors = await prisma.tenantUser.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
        role: "doctor",
      },
      select: {
        id: true,
        fullName: true,
        specialty: true,
        rppsNumber: true,
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      data: doctors,
      total: doctors.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/doctors]", error);
    return NextResponse.json(
      { error: "Failed to fetch doctors", success: false },
      { status: 500 }
    );
  }
}
