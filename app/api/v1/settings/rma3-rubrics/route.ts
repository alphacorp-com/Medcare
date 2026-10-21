import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { findOverlaps } from "@/lib/diagnoses/icd10-ranges";
import { loadRubrics } from "@/lib/reports/rma3-rubrics";

// GET /api/v1/settings/rma3-rubrics — the tenant's ICD-10 → RMA3 cause correspondence
// (seeded with the standard proposal on first access), plus, per table, the ICD-10
// categories claimed by two active rubrics (only the first one counts them).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const rubrics = await loadRubrics(session.user.tenantId);
    const sections = [...new Set(rubrics.map((r) => r.section))];
    const overlaps = Object.fromEntries(sections.map((s) => [s, findOverlaps(rubrics.filter((r) => r.section === s))]));
    return NextResponse.json({ data: rubrics, overlaps });
  } catch (error) {
    console.error("[GET /api/v1/settings/rma3-rubrics]", error);
    return NextResponse.json({ error: "Failed to load the RMA3 correspondence" }, { status: 500 });
  }
}
