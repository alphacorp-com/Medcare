import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid, parseReadingInput } from "@/lib/epi/input";
import { badRequest, monthRange, requireEpiAccess } from "@/lib/epi/route-auth";

// ── GET /api/v1/cold-chain/readings?month=YYYY-MM&equipmentId= ──────────────
// Temperature readings of the month (one equipment or all), most recent first, each flagged
// when outside its equipment's range.
export async function GET(request: Request) {
  try {
    const access = await requireEpiAccess("read");
    if (!access.ok) return access.response;
    const params = new URL(request.url).searchParams;
    const range = monthRange(params.get("month"));
    if (!range) return badRequest("invalid_month");
    const equipmentId = params.get("equipmentId");
    if (equipmentId && !isUuid(equipmentId)) return badRequest("invalid_equipment");

    const readings = await prisma.coldChainReading.findMany({
      where: { tenantId: access.tenantId, readAt: { gte: range.start, lt: range.end }, ...(equipmentId ? { equipmentId } : {}) },
      orderBy: { readAt: "desc" },
      take: 500,
      include: { equipment: { select: { code: true, label: true, minTempC: true, maxTempC: true } } },
    });
    return NextResponse.json({
      data: readings.map(({ equipment, temperatureC, ...r }) => {
        const t = Number(temperatureC);
        return {
          ...r,
          temperatureC: t,
          equipmentCode: equipment.code,
          equipmentLabel: equipment.label,
          alarm: t < Number(equipment.minTempC) ? "low" : t > Number(equipment.maxTempC) ? "high" : null,
        };
      }),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/cold-chain/readings]", error);
    return NextResponse.json({ error: "Failed to fetch readings", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/cold-chain/readings ────────────────────────────────────────
// Body: { equipmentId, temperatureC, readAt? (ISO, default now, not in the future), notes? }
export async function POST(request: Request) {
  try {
    const access = await requireEpiAccess("create");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("invalid_body");
    const parsed = parseReadingInput(body as Record<string, unknown>);
    if (!parsed.ok) return badRequest(parsed.error);

    const equipment = await prisma.coldChainEquipment.findFirst({
      where: { id: parsed.value.equipmentId, tenantId: access.tenantId, isActive: true },
      select: { id: true, minTempC: true, maxTempC: true },
    });
    if (!equipment) return badRequest("invalid_equipment");

    const reading = await prisma.coldChainReading.create({
      data: { tenantId: access.tenantId, recordedById: access.userId, ...parsed.value },
    });
    const t = parsed.value.temperatureC;
    const alarm = t < Number(equipment.minTempC) ? "low" : t > Number(equipment.maxTempC) ? "high" : null;
    return NextResponse.json({ data: { ...reading, temperatureC: t, alarm }, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/cold-chain/readings]", error);
    return NextResponse.json({ error: "Failed to record the reading", success: false }, { status: 500 });
  }
}
