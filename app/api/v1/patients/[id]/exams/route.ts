import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ExamType, ExamRequestStatus } from "@prisma/client";

// ── GET /api/v1/patients/:id/exams ────────────────────────────────────────────
// Query params:
//   type   – optional ExamType filter (biology | radiology | pathology | ...)
//   status – optional ExamRequestStatus filter
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ExamType | null;
    const status = searchParams.get("status") as ExamRequestStatus | null;

    const examRequests = await prisma.examRequest.findMany({
      where: {
        patientId: id,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { requestedAt: "desc" },
      include: {
        results: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({
      data: examRequests,
      total: examRequests.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/exams]", error);
    return NextResponse.json(
      { error: "Failed to fetch exams", success: false },
      { status: 500 }
    );
  }
}
