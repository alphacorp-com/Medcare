import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasModulePermission } from "@/lib/permissions";
import { discardOpenVial } from "@/lib/stock/vaccines";

// ── POST /api/v1/stock/open-vials/:id/discard ───────────────────────────────
// Closes an opened multi-dose vial before its use-by time (end of session, contamination):
// its remaining doses count as wasted. Vaccinators (disease programs) or the pharmacy.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasModulePermission(session, "MODULE_DISEASE_PROGRAMS", "create") && !hasModulePermission(session, "MODULE_PHARMACY", "update")) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Open vial not found", success: false }, { status: 404 });
    }
    const closed = await discardOpenVial(tenantId, id);
    if (!closed) {
      return NextResponse.json({ error: "Open vial not found", success: false }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/v1/stock/open-vials/:id/discard]", error);
    return NextResponse.json({ error: "Failed to discard the vial", success: false }, { status: 500 });
  }
}
