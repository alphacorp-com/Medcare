import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireTenantAdmin } from "@/lib/permissions";

// Guard of the staff register routes (RMA3 VI.5): tenant administrators only.
export async function staffGuard() {
  const session = await getServerSession(authOptions);
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) return { ok: false as const, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session!.user.tenantId;
  if (!tenantId) return { ok: false as const, response: NextResponse.json({ error: "A facility account is required" }, { status: 403 }) };
  return { ok: true as const, tenantId, userId: session!.user.id };
}

// A linked user account must belong to the facility.
export async function userInTenant(tenantId: string, tenantUserId: string | null | undefined): Promise<boolean> {
  if (!tenantUserId) return true;
  return Boolean(await prisma.tenantUser.findFirst({ where: { id: tenantUserId, tenantId }, select: { id: true } }));
}
