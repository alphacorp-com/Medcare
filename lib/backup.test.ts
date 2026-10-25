import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, pgDumpArgs, pgDumpTarget } from "./backup";

test("moves the password out of the connection string and drops Prisma-only parameters", () => {
  const target = pgDumpTarget("postgresql://medcare:s%40cret@db.example.com:5432/medcare?schema=tenant_template&sslmode=require");
  assert.ok(target);
  assert.equal(target.password, "s@cret");
  assert.equal(target.connectionString, "postgresql://medcare@db.example.com:5432/medcare?sslmode=require");
  assert.equal(target.connectionString.includes("cret"), false);
});

test("keeps a connection without password", () => {
  const target = pgDumpTarget("postgres://postgres@127.0.0.1:55432/medcare_seed");
  assert.deepEqual(target, { connectionString: "postgres://postgres@127.0.0.1:55432/medcare_seed", password: null });
});

test("rejects a missing, malformed or non-PostgreSQL URL", () => {
  assert.equal(pgDumpTarget(undefined), null);
  assert.equal(pgDumpTarget("not a url"), null);
  assert.equal(pgDumpTarget("mysql://u:p@h/db"), null);
});

test("pg_dump arguments: custom format, no owner, the target last", () => {
  const args = pgDumpArgs({ connectionString: "postgresql://u@h/db", password: "x" });
  assert.deepEqual(args, ["--format=custom", "--no-owner", "--no-privileges", "--dbname=postgresql://u@h/db"]);
  assert.equal(args.some((a) => a.includes("x@")), false);
});

test("file name is dated in UTC", () => {
  assert.equal(backupFileName(new Date(Date.UTC(2026, 9, 5, 7, 3))), "medcare-20261005-0703.dump");
});
