import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { getRadiologySettings, saveRadiologySettings } from "@/lib/radiology/settings";
import { isValidViewerTemplate } from "@/lib/radiology/safety";

// GET/PUT /api/v1/settings/radiology — PACS viewer link and double reading. Administrator only.
async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) return { response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  return { session };
}

export async function GET() {
  const g = await guard();
  if ("response" in g) return g.response;
  return NextResponse.json(await getRadiologySettings(g.session.user.tenantId));
}

export async function PUT(request: Request) {
  const g = await guard();
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => null)) as { pacsViewerUrlTemplate?: unknown; requireSecondReader?: unknown } | null;
  const template = typeof body?.pacsViewerUrlTemplate === "string" ? body.pacsViewerUrlTemplate.trim() : "";
  if (template && !isValidViewerTemplate(template)) {
    return NextResponse.json({ error: "invalid_viewer_template" }, { status: 400 });
  }
  const settings = { pacsViewerUrlTemplate: template || null, requireSecondReader: body?.requireSecondReader === true };
  await saveRadiologySettings(g.session.user.tenantId!, settings, g.session.user.id);
  await recordAuditEvent({
    tenantId: g.session.user.tenantId,
    actorId: g.session.user.id,
    actorType: "tenant_user",
    action: "settings.radiology_updated",
    resourceType: "tenant_setting",
    payload: settings,
    ...extractRequestMeta(request.headers),
  });
  return NextResponse.json(settings);
}
