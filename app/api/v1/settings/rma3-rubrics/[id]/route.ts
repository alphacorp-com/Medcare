import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { parseRubricUpdate } from "@/lib/reports/rubric-update";
import { DEFAULT_RMA3_RUBRICS } from "@/lib/reports/rma3-rubrics-default";

// PATCH /api/v1/settings/rma3-rubrics/[id] — edit a rubric's label, ICD-10 list, order or
// active flag. Body: { label?, icd10Ranges?, isActive?, order? } or { reset: true } to
// restore the standard values. Section and code are never editable. Every change is
// written to the audit log (before/after) since it changes the RMA3 figures.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const existing = await prisma.rma3DiagnosisRubric.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Rubric not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  let data: { label?: string; icd10Ranges?: string; isActive?: boolean; order?: number };
  if (body && typeof body === "object" && (body as { reset?: unknown }).reset === true) {
    const standard = DEFAULT_RMA3_RUBRICS.find((r) => r.code === existing.code);
    if (!standard) return NextResponse.json({ error: "No standard value for this rubric" }, { status: 400 });
    data = { label: standard.label, icd10Ranges: standard.icd10Ranges, isActive: standard.isActive, order: standard.order };
  } else {
    const parsed = parseRubricUpdate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid rubric", code: parsed.error, token: parsed.token }, { status: 400 });
    }
    data = parsed.value;
  }

  try {
    const updated = await prisma.rma3DiagnosisRubric.update({
      where: { id },
      data: { ...data, updatedById: session.user.id },
    });

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "rma3_rubric.update",
      resourceType: "rma3_rubric",
      resourceId: id,
      payload: {
        code: existing.code,
        ...(data.label !== undefined && data.label !== existing.label ? { labelChanged: { from: existing.label, to: updated.label } } : {}),
        ...(data.icd10Ranges !== undefined && data.icd10Ranges !== existing.icd10Ranges
          ? { icd10RangesChanged: { from: existing.icd10Ranges, to: updated.icd10Ranges } }
          : {}),
        ...(data.isActive !== undefined && data.isActive !== existing.isActive ? { isActiveChanged: { from: existing.isActive, to: updated.isActive } } : {}),
        ...(data.order !== undefined && data.order !== existing.order ? { orderChanged: { from: existing.order, to: updated.order } } : {}),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[PATCH /api/v1/settings/rma3-rubrics/[id]]", error);
    return NextResponse.json({ error: "Failed to update the rubric" }, { status: 500 });
  }
}
