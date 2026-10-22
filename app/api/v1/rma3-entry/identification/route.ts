import { NextResponse } from "next/server";
import { loadIdentification, saveIdentification } from "@/lib/rma3-manual/data";
import { parseIdentification } from "@/lib/rma3-manual/input";
import { auditRma3, badRequest, errorResponse, requireRma3Access } from "@/lib/rma3-manual/route-auth";

// ── GET /api/v1/rma3-entry/identification ───────────────────────────────────
// The MINSANTE identification of the facility (region, district, health area…).
export async function GET() {
  try {
    const guard = await requireRma3Access("read");
    if (!guard.ok) return guard.response;
    return NextResponse.json({ data: await loadIdentification(guard.access.tenantId) });
  } catch (error) {
    return errorResponse(error, "GET identification");
  }
}

// ── PUT /api/v1/rma3-entry/identification ───────────────────────────────────
// Body: the whole identification (every field optional; an empty field is cleared).
export async function PUT(request: Request) {
  try {
    const guard = await requireRma3Access("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const parsed = parseIdentification(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);

    await saveIdentification(access.tenantId, parsed.value, access.userId);
    await auditRma3(request, access, "rma3.identification_update", access.tenantId, { identification: parsed.value });
    return NextResponse.json({ data: parsed.value });
  } catch (error) {
    return errorResponse(error, "PUT identification");
  }
}
