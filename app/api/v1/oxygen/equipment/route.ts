import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseEquipment, type EquipmentInput } from "@/lib/programs/input";
import { programError } from "@/lib/programs/route-helpers";

// GET /api/v1/oxygen/equipment — the biomedical equipment park (oximeters, concentrators,
// ventilators, 7 500 L cylinders…), RMA3 V.9.
export async function GET() {
  const guard = await requireEpiAccess("read");
  if (!guard.ok) return guard.response;
  const equipment = await prisma.biomedicalEquipment.findMany({ where: { tenantId: guard.tenantId }, orderBy: [{ type: "asc" }, { code: "asc" }] });
  return NextResponse.json({ data: equipment });
}

// POST /api/v1/oxygen/equipment — Body: { code, type, label, serialNumber?, location?, status? }
export async function POST(request: Request) {
  const guard = await requireEpiAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseEquipment(await request.json().catch(() => null), { partial: false });
  if (!parsed.ok) return programError(parsed.error);
  try {
    const equipment = await prisma.biomedicalEquipment.create({ data: { ...(parsed.value as EquipmentInput), tenantId: guard.tenantId } });
    return NextResponse.json({ data: equipment }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return programError("duplicate_code", 409);
    console.error("[POST /api/v1/oxygen/equipment]", error);
    return NextResponse.json({ error: "Failed to save the equipment" }, { status: 500 });
  }
}
