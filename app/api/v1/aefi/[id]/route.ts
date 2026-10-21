import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { AEFI_OUTCOMES, AEFI_SERIOUSNESS, isUuid } from "@/lib/epi/input";
import { badRequest, requireEpiAccess } from "@/lib/epi/route-auth";

// ── PATCH /api/v1/aefi/:id ──────────────────────────────────────────────────
// Body: { outcome?, seriousness?, hospitalized? } — follow-up of the case (the dose, onset
// and description stay as reported).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireEpiAccess("update");
    if (!access.ok) return access.response;
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "AEFI not found", success: false }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid_body");
    const data: { outcome?: (typeof AEFI_OUTCOMES)[number]; seriousness?: (typeof AEFI_SERIOUSNESS)[number]; hospitalized?: boolean } = {};
    if (body.outcome !== undefined) {
      if (!(AEFI_OUTCOMES as readonly unknown[]).includes(body.outcome)) return badRequest("invalid_outcome");
      data.outcome = body.outcome as (typeof AEFI_OUTCOMES)[number];
    }
    if (body.seriousness !== undefined) {
      if (!(AEFI_SERIOUSNESS as readonly unknown[]).includes(body.seriousness)) return badRequest("invalid_seriousness");
      data.seriousness = body.seriousness as (typeof AEFI_SERIOUSNESS)[number];
    }
    if (body.hospitalized !== undefined) {
      if (typeof body.hospitalized !== "boolean") return badRequest("invalid_body");
      data.hospitalized = body.hospitalized;
    }
    if (Object.keys(data).length === 0) return badRequest("invalid_body");

    const existing = await prisma.aefiReport.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: "AEFI not found", success: false }, { status: 404 });

    const report = await prisma.aefiReport.update({ where: { id: existing.id }, data });
    await recordAuditEvent({
      tenantId: access.tenantId,
      actorId: access.userId,
      actorType: "tenant_user",
      action: "aefi.update",
      resourceType: "aefi_report",
      resourceId: report.id,
      payload: { changed: data },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ data: report, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/aefi/:id]", error);
    return NextResponse.json({ error: "Failed to update the AEFI", success: false }, { status: 500 });
  }
}
