import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { isUuid, parseEquipmentInput } from "@/lib/epi/input";
import { badRequest, requireEpiAccess } from "@/lib/epi/route-auth";

// ── PATCH /api/v1/cold-chain/equipment/:id ──────────────────────────────────
// Body: the full equipment (as POST), or { isActive: false } to retire it (its readings are
// kept for past reports).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireEpiAccess("update");
    if (!access.ok) return access.response;
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Equipment not found", success: false }, { status: 404 });
    const existing = await prisma.coldChainEquipment.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: "Equipment not found", success: false }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid_body");

    let data;
    if (body.isActive === false && Object.keys(body).length === 1) {
      data = { isActive: false };
    } else {
      const parsed = parseEquipmentInput(body);
      if (!parsed.ok) return badRequest(parsed.error);
      if (parsed.value.locationId) {
        const location = await prisma.storageLocation.findFirst({ where: { id: parsed.value.locationId, tenantId: access.tenantId }, select: { id: true } });
        if (!location) return badRequest("invalid_location");
      }
      if (parsed.value.code !== existing.code) {
        const duplicate = await prisma.coldChainEquipment.findFirst({ where: { tenantId: access.tenantId, code: parsed.value.code }, select: { id: true } });
        if (duplicate) return badRequest("duplicate_code");
      }
      data = parsed.value;
    }

    const equipment = await prisma.coldChainEquipment.update({ where: { id: existing.id }, data });
    await recordAuditEvent({
      tenantId: access.tenantId,
      actorId: access.userId,
      actorType: "tenant_user",
      action: "cold_chain_equipment.update",
      resourceType: "cold_chain_equipment",
      resourceId: equipment.id,
      payload: { code: equipment.code, statusFrom: existing.status, statusTo: equipment.status, isActive: equipment.isActive },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ data: equipment, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/cold-chain/equipment/:id]", error);
    return NextResponse.json({ error: "Failed to update the equipment", success: false }, { status: 500 });
  }
}
