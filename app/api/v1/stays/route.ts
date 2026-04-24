import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { StayStatus } from "@prisma/client";

// ── GET /api/v1/stays ───────────────────────────────────────────────────────
// Query params:
//   status – optional StayStatus filter (pre_admission | in_progress | discharged | transferred | deceased)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as StayStatus | null;

    const stays = await prisma.stay.findMany({
      where: {
        ...(status ? { status } : {}),
      },
      orderBy: { admissionDate: "desc" },
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
    });

    return NextResponse.json({ data: stays, total: stays.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays]", error);
    return NextResponse.json(
      { error: "Failed to fetch stays", success: false },
      { status: 500 }
    );
  }
}
