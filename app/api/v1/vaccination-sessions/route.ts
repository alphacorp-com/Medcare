import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseSessionInput } from "@/lib/epi/input";
import { badRequest, monthRange, requireEpiAccess } from "@/lib/epi/route-auth";

// ── GET /api/v1/vaccination-sessions?month=YYYY-MM ──────────────────────────
// Sessions scheduled in the month (current month by default), with their dose count.
export async function GET(request: Request) {
  try {
    const access = await requireEpiAccess("read");
    if (!access.ok) return access.response;
    const range = monthRange(new URL(request.url).searchParams.get("month"));
    if (!range) return badRequest("invalid_month");

    const sessions = await prisma.vaccinationSession.findMany({
      where: { tenantId: access.tenantId, scheduledDate: { gte: range.start, lt: range.end } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { immunizations: true } } },
    });
    return NextResponse.json({
      data: sessions.map(({ _count, ...s }) => ({ ...s, doses: _count.immunizations })),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/vaccination-sessions]", error);
    return NextResponse.json({ error: "Failed to fetch sessions", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/vaccination-sessions ───────────────────────────────────────
// Body: { scheduledDate: YYYY-MM-DD, strategy: fixed|outreach, site, notes? }
export async function POST(request: Request) {
  try {
    const access = await requireEpiAccess("create");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("invalid_body");
    const parsed = parseSessionInput(body as Record<string, unknown>);
    if (!parsed.ok) return badRequest(parsed.error);

    const session = await prisma.vaccinationSession.create({
      data: { tenantId: access.tenantId, ...parsed.value, createdById: access.userId },
    });
    return NextResponse.json({ data: session, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/vaccination-sessions]", error);
    return NextResponse.json({ error: "Failed to create the session", success: false }, { status: 500 });
  }
}
