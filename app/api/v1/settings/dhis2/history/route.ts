import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { RMA3_PUSH_ACTION } from "@/lib/dhis2/sync";

// Former 18-indicator push: its lines stay readable in the history.
const LEGACY_SYNC_ACTION = "dhis2.sync";

export interface Dhis2HistoryEntry {
  id: string;
  createdAt: Date;
  period: string;
  trigger: "auto" | "manual";
  dryRun: boolean;
  status: "success" | "failed" | "skipped";
  values: number | null;
  error: string | null;
  legacy: boolean;
}

interface PushPayload {
  period?: string;
  trigger?: "auto" | "manual";
  dryRun?: boolean;
  ok?: boolean;
  sent?: number;
  error?: string | null;
}

interface LegacyPayload {
  period?: string;
  status?: "success" | "failed" | "skipped";
  dataValueCount?: number;
  error?: string;
}

// GET /api/v1/settings/dhis2/history — the last 24 sends to DHIS2 of this facility (automatic,
// manual and simulations), most recent first.
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
    where: { tenantId: session.user.tenantId, action: { in: [RMA3_PUSH_ACTION, LEGACY_SYNC_ACTION] } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { id: true, createdAt: true, action: true, actorType: true, resourceId: true, payload: true },
  });

  const history: Dhis2HistoryEntry[] = logs.map((log) => {
    const trigger = log.actorType === "system" ? "auto" : "manual";
    if (log.action === LEGACY_SYNC_ACTION) {
      const p = (log.payload ?? {}) as LegacyPayload;
      return { id: log.id, createdAt: log.createdAt, period: p.period ?? "", trigger, dryRun: false, status: p.status ?? "failed", values: p.dataValueCount ?? null, error: p.error ?? null, legacy: true };
    }
    const p = (log.payload ?? {}) as PushPayload;
    return {
      id: log.id,
      createdAt: log.createdAt,
      period: p.period ?? log.resourceId ?? "",
      trigger: p.trigger ?? trigger,
      dryRun: p.dryRun === true,
      status: p.ok ? "success" : "failed",
      values: p.sent ?? null,
      error: p.error ?? null,
      legacy: false,
    };
  });

  return NextResponse.json({ history });
}
