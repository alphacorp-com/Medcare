import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { MalariaResult } from "@prisma/client";

// ── GET /api/v1/malaria-cases ────────────────────────────────────────────────
// Query params: result?, pregnant? ("true"), from?, to? (ISO dates, filters diagnosedAt)
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
  const result = searchParams.get("result") as MalariaResult | null;
  const pregnant = searchParams.get("pregnant");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const cases = await prisma.malariaCase.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(result ? { result } : {}),
      ...(pregnant === "true" ? { isPregnantAtDiagnosis: true } : {}),
      ...(from || to
        ? { diagnosedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true } } },
    orderBy: { diagnosedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: cases, total: cases.length, success: true });
}
