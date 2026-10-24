import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseNutritionUpdate } from "@/lib/programs/input";
import { PATIENT_REF, programError } from "@/lib/programs/route-helpers";

// PATCH /api/v1/nutrition/cases/[id] — Body: { hivTested?, anjeCounseling?, exitReason?
// (cured|defaulted|died|non_responder|transfer_out, null to reopen), exitedAt? }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const current = await prisma.nutritionCase.findFirst({ where: { id, tenantId: guard.tenantId }, select: { admittedAt: true } });
  if (!current) return programError("not_found", 404);
  const parsed = parseNutritionUpdate(await request.json().catch(() => null), current.admittedAt);
  if (!parsed.ok) return programError(parsed.error);
  const { exit, ...rest } = parsed.value;
  const updated = await prisma.nutritionCase.update({
    where: { id },
    data: { ...rest, ...(exit === undefined ? {} : exit === null ? { exitedAt: null, exitReason: null } : exit) },
    include: { patient: PATIENT_REF },
  });
  return NextResponse.json({ data: updated });
}
