import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { parseEquipmentInput } from "@/lib/epi/input";
import { badRequest, requireEpiAccess } from "@/lib/epi/route-auth";

// ── GET /api/v1/cold-chain/equipment ────────────────────────────────────────
// Active equipment with its last reading (and whether it is out of range).
export async function GET() {
  try {
    const access = await requireEpiAccess("read");
    if (!access.ok) return access.response;
    const equipment = await prisma.coldChainEquipment.findMany({
      where: { tenantId: access.tenantId, isActive: true },
      orderBy: { code: "asc" },
      include: { readings: { orderBy: { readAt: "desc" }, take: 1, select: { readAt: true, temperatureC: true } } },
    });
    return NextResponse.json({
      data: equipment.map(({ readings, minTempC, maxTempC, ...e }) => {
        const last = readings[0];
        const temperature = last ? Number(last.temperatureC) : null;
        return {
          ...e,
          minTempC: Number(minTempC),
          maxTempC: Number(maxTempC),
          lastReading: last ? { readAt: last.readAt, temperatureC: temperature } : null,
          outOfRange: temperature !== null && (temperature < Number(minTempC) || temperature > Number(maxTempC)),
        };
      }),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/cold-chain/equipment]", error);
    return NextResponse.json({ error: "Failed to fetch cold chain equipment", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/cold-chain/equipment ───────────────────────────────────────
// Body: { code, type, label, locationId?, minTempC?, maxTempC?, status? } (range defaults to
// the type's standard range).
export async function POST(request: Request) {
  try {
    const access = await requireEpiAccess("create");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("invalid_body");
    const parsed = parseEquipmentInput(body as Record<string, unknown>);
    if (!parsed.ok) return badRequest(parsed.error);
    if (parsed.value.locationId) {
      const location = await prisma.storageLocation.findFirst({ where: { id: parsed.value.locationId, tenantId: access.tenantId }, select: { id: true } });
      if (!location) return badRequest("invalid_location");
    }
    const duplicate = await prisma.coldChainEquipment.findFirst({ where: { tenantId: access.tenantId, code: parsed.value.code }, select: { id: true } });
    if (duplicate) return badRequest("duplicate_code");

    const equipment = await prisma.coldChainEquipment.create({ data: { tenantId: access.tenantId, ...parsed.value } });
    await recordAuditEvent({
      tenantId: access.tenantId,
      actorId: access.userId,
      actorType: "tenant_user",
      action: "cold_chain_equipment.create",
      resourceType: "cold_chain_equipment",
      resourceId: equipment.id,
      payload: { code: equipment.code, label: equipment.label },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ data: equipment, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/cold-chain/equipment]", error);
    return NextResponse.json({ error: "Failed to create the equipment", success: false }, { status: 500 });
  }
}
