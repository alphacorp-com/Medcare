import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── GET /api/v1/departments ─────────────────────────────────────────────────
// Returns all active departments for use in dropdowns.
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        location: true,
        phone: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      data: departments,
      total: departments.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/departments]", error);
    return NextResponse.json(
      { error: "Failed to fetch departments", success: false },
      { status: 500 }
    );
  }
}
