import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { normalizeDocumentTemplateSettings, parseDocumentTemplateSettings } from "@/lib/document-templates";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";

const SETTING_KEY = "document_templates";

// GET /api/v1/settings/templates — the document settings every print site applies (any
// signed-in member of the facility prints documents), defaults filled in.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: session.user.tenantId, key: SETTING_KEY } },
    });
    return NextResponse.json(normalizeDocumentTemplateSettings(setting?.value));
  } catch (error) {
    console.error("Error fetching template settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/v1/settings/templates — Body: the whole settings (lib/document-templates).
// What prints on every document of the facility: tenant administrators only, validated.
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const parsed = parseDocumentTemplateSettings(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const tenantId = session.user.tenantId;
    const setting = await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: SETTING_KEY } },
      update: { value: parsed.value },
      create: { tenantId, key: SETTING_KEY, value: parsed.value },
    });

    await recordAuditEvent({
      tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "settings.document_templates_updated",
      resourceType: "tenant_setting",
      resourceId: SETTING_KEY,
      payload: { templates: Object.keys(parsed.value.templates) },
      ...extractRequestMeta(req.headers),
    });

    return NextResponse.json(normalizeDocumentTemplateSettings(setting.value));
  } catch (error) {
    console.error("Error updating template settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
