import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid, parseSessionStatus } from "@/lib/epi/input";
import { badRequest, requireEpiAccess } from "@/lib/epi/route-auth";

// ── PATCH /api/v1/vaccination-sessions/:id ──────────────────────────────────
// Body: { status: planned|held|cancelled }. A session with doses can't be cancelled
// (its doses were given), and held keeps the first time it was marked held.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireEpiAccess("update");
    if (!access.ok) return access.response;
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Session not found", success: false }, { status: 404 });

    const body = await request.json().catch(() => null);
    const status = parseSessionStatus((body as { status?: unknown } | null)?.status);
    if (!status.ok) return badRequest(status.error);

    const existing = await prisma.vaccinationSession.findFirst({
      where: { id, tenantId: access.tenantId },
      include: { _count: { select: { immunizations: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Session not found", success: false }, { status: 404 });
    if (status.value !== "held" && existing._count.immunizations > 0) return badRequest("session_has_doses");

    const session = await prisma.vaccinationSession.update({
      where: { id: existing.id },
      data: { status: status.value, heldAt: status.value === "held" ? existing.heldAt ?? new Date() : null },
    });
    return NextResponse.json({ data: session, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/vaccination-sessions/:id]", error);
    return NextResponse.json({ error: "Failed to update the session", success: false }, { status: 500 });
  }
}
