import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseInvestigation } from "@/lib/programs/input-complements";
import { pharmacyGuard } from "@/lib/stock/pharmacy-guard";

// PATCH /api/v1/pharmacy/adverse-reactions/[id] — Body: { investigatedAt?, outcome? } — the
// investigation of a reaction (RMA3 V.8-003).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await pharmacyGuard("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const reaction = await prisma.drugAdverseReaction.findFirst({ where: { id, tenantId: guard.tenantId }, select: { reactionAt: true } });
  if (!reaction) return NextResponse.json({ error: "not_found", code: "not_found" }, { status: 404 });
  const parsed = parseInvestigation(await request.json().catch(() => null), reaction.reactionAt);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
  const updated = await prisma.drugAdverseReaction.update({ where: { id }, data: parsed.value });
  return NextResponse.json({ data: updated });
}
