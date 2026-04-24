import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/v1/doctors ─────────────────────────────────────────────────────
// Returns all active doctors (TenantUser with role=doctor) for use in dropdowns.
export async function GET() {
  try {
    const doctors = await prisma.tenantUser.findMany({
      where: {
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
