import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { TbClassification, TbTreatmentOutcome } from "@prisma/client";

// ── GET /api/v1/tb-cases ─────────────────────────────────────────────────────
// Query params: outcome?, classification?, from?, to? (ISO dates, filters notificationDate)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const outcome = searchParams.get("outcome") as TbTreatmentOutcome | null;
  const classification = searchParams.get("classification") as TbClassification | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const cases = await prisma.tbCase.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(outcome ? { outcome } : {}),
      ...(classification ? { classification } : {}),
      ...(from || to
        ? { notificationDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true } } },
    orderBy: { notificationDate: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: cases, total: cases.length, success: true });
}
