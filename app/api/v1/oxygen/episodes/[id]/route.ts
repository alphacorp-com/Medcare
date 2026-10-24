import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseHypoxemiaOutcome } from "@/lib/programs/input";
import { programError } from "@/lib/programs/route-helpers";

// PATCH /api/v1/oxygen/episodes/[id] — Body: { oxygenGiven?, outcome? (cured|referred|
// left_against_advice|died, null to clear), outcomeAt? }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const episode = await prisma.hypoxemiaEpisode.findFirst({ where: { id, tenantId: guard.tenantId }, select: { detectedAt: true } });
  if (!episode) return programError("not_found", 404);
  const parsed = parseHypoxemiaOutcome(await request.json().catch(() => null), episode.detectedAt);
  if (!parsed.ok) return programError(parsed.error);
  const updated = await prisma.hypoxemiaEpisode.update({ where: { id }, data: parsed.value });
  return NextResponse.json({ data: updated });
}
