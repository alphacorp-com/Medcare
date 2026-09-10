import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/immunizations ────────────────────────────────────────────────
// Query params: antigenCode?, from?, to? (ISO dates, filters administeredAt)
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
  const antigenCode = searchParams.get("antigenCode") || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const immunizations = await prisma.immunization.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(antigenCode ? { antigenCode } : {}),
      ...(from || to
        ? { administeredAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true, ipp: true } } },
    orderBy: { administeredAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: immunizations, total: immunizations.length, success: true });
}
