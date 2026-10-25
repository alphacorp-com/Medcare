// Database backup by pg_dump (Settings > Backup). Pure helpers, unit-tested in backup.test.ts;
// the process itself is spawned by app/api/v1/settings/database/route.ts.

export type PgDumpTarget = {
  // Connection string without its password (passed in PGPASSWORD instead, so it never shows in
  // the server's process list) and without Prisma-only parameters libpq would reject.
  connectionString: string;
  password: string | null;
};

// Query parameters Prisma accepts in DATABASE_URL that are not libpq connection parameters.
const PRISMA_ONLY_PARAMS = ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size", "socket_timeout"];

export function pgDumpTarget(databaseUrl: string | undefined): PgDumpTarget | null {
  if (!databaseUrl) return null;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return null;

  const password = url.password ? decodeURIComponent(url.password) : null;
  url.password = "";
  for (const param of PRISMA_ONLY_PARAMS) url.searchParams.delete(param);
  return { connectionString: url.toString(), password };
}

// Arguments of pg_dump: custom (compressed) format, restorable with pg_restore, without owners
// and privileges so it restores into any database role.
export function pgDumpArgs(target: PgDumpTarget): string[] {
  return ["--format=custom", "--no-owner", "--no-privileges", `--dbname=${target.connectionString}`];
}

// medcare-AAAAMMJJ-HHmm.dump (UTC), safe in a Content-Disposition header.
export function backupFileName(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `medcare-${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}.dump`;
}
