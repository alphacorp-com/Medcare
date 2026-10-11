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
//            Otherwise most recent admission first.
//   q      – search on patient last/first name, IPP or stay number
//   page   – page number (default 1)
//   limit  – page size (default 20, max 200)
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
    const q = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const orderBy: Prisma.StayOrderByWithRelationInput[] =
      sort === "acuity"
        ? [{ triageAcuity: "asc" }, { admissionDate: "asc" }, { id: "asc" }]
        : [{ admissionDate: "desc" }, { id: "desc" }];

    const where: Prisma.StayWhereInput = {
      tenantId: session.user.tenantId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? {
            OR: [
              { stayNumber: { contains: q, mode: "insensitive" } },
              { patient: { lastName: { contains: q, mode: "insensitive" } } },
              { patient: { firstName: { contains: q, mode: "insensitive" } } },
              { patient: { ipp: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [stays, total] = await Promise.all([
      prisma.stay.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
      }),
      prisma.stay.count({ where }),
    ]);

    return NextResponse.json({ data: stays, total, page, limit, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays]", error);
    return NextResponse.json(
      { error: "Failed to fetch stays", success: false },
      { status: 500 }
    );
  }
}
