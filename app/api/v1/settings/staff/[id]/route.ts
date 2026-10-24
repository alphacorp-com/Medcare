import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { parseStaffMember } from "@/lib/hr/input";
import { staffGuard, userInTenant } from "@/lib/hr/route-auth";

// PATCH /api/v1/settings/staff/[id] — any field; a departure is recorded with leftAt (the
// history of the register is kept: no deletion).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await staffGuard();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const existing = await prisma.staffMember.findFirst({ where: { id, tenantId: guard.tenantId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not_found", code: "not_found" }, { status: 404 });
  const parsed = parseStaffMember(await request.json().catch(() => null), { partial: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
  if (!(await userInTenant(guard.tenantId, parsed.value.tenantUserId))) return NextResponse.json({ error: "invalid_user", code: "invalid_user" }, { status: 400 });
  const member = await prisma.staffMember.update({ where: { id }, data: parsed.value });
  await recordAuditEvent({
    tenantId: guard.tenantId,
    actorId: guard.userId,
    actorType: "tenant_user",
    action: "staff.update",
    resourceType: "staff_member",
    resourceId: id,
    payload: { fields: Object.keys(parsed.value) },
    ...extractRequestMeta(request.headers),
  });
  return NextResponse.json({ data: member });
}
