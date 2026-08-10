import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { StayStatus, StayType, Prisma } from "@prisma/client";

// ── GET /api/v1/stays ───────────────────────────────────────────────────────
// Query params:
//   status – optional StayStatus filter (pre_admission | in_progress | discharged | transferred | deceased)
//   type   – optional StayType filter (emergency | scheduled | day_care | outpatient)
//   sort   – "acuity" sorts by triage acuity (most critical first, non-triaged
//            last), tie-broken by admission time — used by the triage queue view.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as StayStatus | null;
    const type = searchParams.get("type") as StayType | null;
    const sort = searchParams.get("sort");

    const orderBy: Prisma.StayOrderByWithRelationInput[] =
      sort === "acuity"
        ? [{ triageAcuity: "asc" }, { admissionDate: "asc" }]
        : [{ admissionDate: "desc" }];

    const stays = await prisma.stay.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy,
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
