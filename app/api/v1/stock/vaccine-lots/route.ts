import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasModulePermission } from "@/lib/permissions";
import { loadVaccineStock } from "@/lib/stock/vaccines";

// ── GET /api/v1/stock/vaccine-lots?antigenCode= ─────────────────────────────
// Lots a vaccinator can use for this antigen (in stock, not expired, first-expiry first).
// `managed: false` means no stock article is linked to the antigen: the lot stays free text.
// Readable from the vaccination screens (disease programs) as well as the pharmacy.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasModulePermission(session, "MODULE_DISEASE_PROGRAMS", "read") && !hasModulePermission(session, "MODULE_PHARMACY", "read")) {
      return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }

    const antigenCode = new URL(request.url).searchParams.get("antigenCode")?.trim();
    if (!antigenCode || antigenCode.length > 40) {
      return NextResponse.json({ error: "antigenCode is required", success: false }, { status: 400 });
    }

    const { managed, lots } = await loadVaccineStock(tenantId, antigenCode, new Date());
    return NextResponse.json({ managed, data: lots, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stock/vaccine-lots]", error);
    return NextResponse.json({ error: "Failed to fetch vaccine lots", success: false }, { status: 500 });
  }
}
