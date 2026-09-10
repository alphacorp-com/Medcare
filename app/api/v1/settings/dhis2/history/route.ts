import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// GET /api/v1/settings/dhis2/history — last 24 sync attempts for this tenant, most recent first.
// Each row's `payload` was written by lib/dhis2/sync.ts (Dhis2SyncSummary shape).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: session.user.tenantId, action: "dhis2.sync" },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  const history = logs.map((log) => ({ id: log.id, createdAt: log.createdAt, ...(log.payload as object) }));

  return NextResponse.json({ history });
}
