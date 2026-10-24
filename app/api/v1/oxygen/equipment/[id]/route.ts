import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseEquipment } from "@/lib/programs/input";
import { programError } from "@/lib/programs/route-helpers";

// PATCH /api/v1/oxygen/equipment/[id] — any field of the equipment, typically its status.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const existing = await prisma.biomedicalEquipment.findFirst({ where: { id, tenantId: guard.tenantId }, select: { id: true } });
  if (!existing) return programError("not_found", 404);
  const parsed = parseEquipment(await request.json().catch(() => null), { partial: true });
  if (!parsed.ok) return programError(parsed.error);
  try {
    const equipment = await prisma.biomedicalEquipment.update({ where: { id }, data: parsed.value });
    return NextResponse.json({ data: equipment });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return programError("duplicate_code", 409);
    console.error("[PATCH /api/v1/oxygen/equipment/:id]", error);
    return NextResponse.json({ error: "Failed to update the equipment" }, { status: 500 });
  }
}
