import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const MAX_RESULTS = 20;
const MAX_QUERY_LENGTH = 80;

// GET /api/v1/icd10?search= — ICD-10 lookup for clinicians coding a diagnosis
// (consultation, discharge, cause of death). Read-only, active codes of the caller's
// tenant only. The settings catalog route stays admin-only for editing.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, MAX_QUERY_LENGTH) ?? "";
  if (!search) return NextResponse.json({ data: [] });

  const codes = await prisma.icd10Code.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      OR: [
        { code: { startsWith: search.toUpperCase() } },
        { labelFr: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { code: true, labelFr: true, chapter: true },
    orderBy: { code: "asc" },
    take: MAX_RESULTS,
  });
  return NextResponse.json({ data: codes });
}
