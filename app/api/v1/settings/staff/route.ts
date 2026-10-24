import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { staffGuard, userInTenant } from "@/lib/hr/route-auth";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { parseStaffMember, type StaffMemberInput } from "@/lib/hr/input";

// Staff register (RMA3 VI.5): tenant administrators only (lib/hr/route-auth).

// GET /api/v1/settings/staff — the whole register (people who left included, flagged).
export async function GET() {
  const guard = await staffGuard();
  if (!guard.ok) return guard.response;
  const staff = await prisma.staffMember.findMany({ where: { tenantId: guard.tenantId }, orderBy: [{ cadre: "asc" }, { fullName: "asc" }] });
  return NextResponse.json({ data: staff });
}

// POST /api/v1/settings/staff
// Body: { fullName, sex, cadre, payer (state|local), inPost?, birthDate?, hiredAt?, retirementDate?,
//         leftAt?, tenantUserId?, notes? }
export async function POST(request: Request) {
  const guard = await staffGuard();
  if (!guard.ok) return guard.response;
  const parsed = parseStaffMember(await request.json().catch(() => null), { partial: false });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
  if (!(await userInTenant(guard.tenantId, parsed.value.tenantUserId))) return NextResponse.json({ error: "invalid_user", code: "invalid_user" }, { status: 400 });
  const member = await prisma.staffMember.create({ data: { ...(parsed.value as StaffMemberInput), tenantId: guard.tenantId } });
  await recordAuditEvent({
    tenantId: guard.tenantId,
    actorId: guard.userId,
    actorType: "tenant_user",
    action: "staff.create",
    resourceType: "staff_member",
    resourceId: member.id,
    ...extractRequestMeta(request.headers),
  });
  return NextResponse.json({ data: member }, { status: 201 });
}
