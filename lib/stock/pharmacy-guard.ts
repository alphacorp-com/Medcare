import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import type { ModuleAction } from "@/types/next-auth";

// Guard of the pharmacovigilance routes: pharmacy module for `action`, facility of the session.
export async function pharmacyGuard(action: ModuleAction) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireModulePermission(session, "MODULE_PHARMACY", action);
  if (!permCheck.ok) return { ok: false as const, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false as const, response: NextResponse.json({ error: "A facility account is required" }, { status: 403 }) };
  return { ok: true as const, tenantId, userId: session.user.id };
}

