import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

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
