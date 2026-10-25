import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { backupFileName, pgDumpArgs, pgDumpTarget } from "@/lib/backup";

// Database backup (Settings > Backup), for the administrator of this install. Each MedCare
// deployment holds a single facility, so the dump only ever contains this facility's data —
// still every patient record: administrators only, rate-limited, audited.
//
// GET ?check=1 — is a backup possible here (pg_dump installed, database configured)?
// GET          — streams a pg_dump (custom format) straight to the browser. Nothing is written
//                on the server's disk; pg_dump is spawned without a shell, the password passed in
//                PGPASSWORD (never on the command line).
//
// Requires the pg_dump binary on the server, of a version at least the database's. Hosted
// platforms without it (Vercel) answer the check with available: false.
export const runtime = "nodejs";

async function pgDumpVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("pg_dump", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? out.trim() : null));
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const target = pgDumpTarget(process.env.DATABASE_URL);
  const version = target ? await pgDumpVersion() : null;

  if (new URL(request.url).searchParams.get("check")) {
    return NextResponse.json({
      available: Boolean(target && version),
      reason: !target ? "database_not_configured" : !version ? "pg_dump_missing" : null,
      pgDumpVersion: version,
    });
  }

  if (!target) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!version) return NextResponse.json({ error: "pg_dump_missing" }, { status: 503 });

  const rateLimit = checkRateLimit(`db-backup:${session.user.id}`, 3, 60 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "too_many_backups" }, { status: 429 });
  }

  const fileName = backupFileName(new Date());
  await recordAuditEvent({
    tenantId: session.user.tenantId,
    actorId: session.user.id,
    actorType: "tenant_user",
    action: "settings.database_backup",
    resourceType: "database",
    resourceId: fileName,
    payload: { fileName },
    ...extractRequestMeta(request.headers),
  });

  const child = spawn("pg_dump", pgDumpArgs(target), {
    env: { ...process.env, ...(target.password ? { PGPASSWORD: target.password } : {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      child.on("error", (error) => controller.error(error));
      child.on("close", (code) => {
        if (code === 0) {
          controller.close();
        } else {
          // Aborting the stream makes the browser report a failed download rather than keep a
          // truncated file that would look like a valid backup.
          console.error("[GET /api/v1/settings/database] pg_dump failed:", stderr.slice(0, 2000));
          controller.error(new Error("pg_dump failed"));
        }
      });
    },
    cancel() {
      child.kill();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
