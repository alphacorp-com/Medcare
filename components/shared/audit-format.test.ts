import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { auditActionLabel, auditActorLabel, auditDetailLines, type AuditTranslator } from "@/components/shared/audit-format";

// Minimal stand-in for next-intl: known keys render as "key{json values}".
const KNOWN = new Set([
  "actions.user.login",
  "unknown_action",
  "system_actor",
  "unknown_actor",
  "fields.role",
  "fields.password",
  "details.changed",
  "details.updated",
  "details.fields",
  "details.reason",
  "details.email",
  "details.yes",
  "details.no",
]);
const t = Object.assign(
  (key: string, values?: Record<string, string | number>) => (values ? `${key}${JSON.stringify(values)}` : key),
  { has: (key: string) => KNOWN.has(key) }
) as AuditTranslator;

describe("auditActionLabel", () => {
  it("translates a known code", () => {
    assert.equal(auditActionLabel("user.login", t), "actions.user.login");
  });

  it("falls back to a readable label for an untranslated code", () => {
    assert.equal(auditActionLabel("stay.bed_swap", t), 'unknown_action{"code":"stay bed swap"}');
  });

  it("never uses a malformed code as a translation key", () => {
    const has = (key: string) => {
      assert.ok(!key.includes(".."), "malformed key looked up");
      return false;
    };
    const guarded = Object.assign((key: string) => key, { has }) as AuditTranslator;
    auditActionLabel("user..login", guarded);
    auditActionLabel("../settings", guarded);
  });
});

describe("auditActorLabel", () => {
  it("uses the name, else System for system rows, else Unknown", () => {
    assert.equal(auditActorLabel("Dr Ada", "tenant_user", t), "Dr Ada");
    assert.equal(auditActorLabel(null, "system", t), "system_actor");
    assert.equal(auditActorLabel(null, "admin", t), "unknown_actor");
  });
});

describe("auditDetailLines", () => {
  it("returns nothing for empty or non-object payloads", () => {
    assert.deepEqual(auditDetailLines(null, t), []);
    assert.deepEqual(auditDetailLines("text", t), []);
    assert.deepEqual(auditDetailLines([1, 2], t), []);
  });

  it("renders from → to changes with translated field names", () => {
    assert.deepEqual(auditDetailLines({ roleChanged: { from: "Nurse", to: "Doctor" } }, t), [
      'details.changed{"field":"fields.role","from":"Nurse","to":"Doctor"}',
    ]);
  });

  it("renders booleans as yes/no", () => {
    assert.deepEqual(auditDetailLines({ isSystemAdminChanged: { from: false, to: true } }, t), [
      'details.changed{"field":"isSystemAdmin","from":"details.no","to":"details.yes"}',
    ]);
  });

  it("summarises structured changes (module lists) instead of dumping them", () => {
    assert.deepEqual(auditDetailLines({ modulesChanged: { from: [{ moduleId: "A" }], to: [] } }, t), [
      'details.updated{"field":"modules"}',
    ]);
  });

  it("lists changed fields and readable values, skipping technical ids", () => {
    assert.deepEqual(auditDetailLines({ fields: ["password", "fullName"], reason: "  Doublon ", stayId: "uuid" }, t), [
      'details.fields{"fields":"fields.password, fullName"}',
      'details.reason{"value":"Doublon"}',
    ]);
  });

  it("truncates long values", () => {
    const [line] = auditDetailLines({ reason: "x".repeat(200) }, t);
    assert.ok(line.length < 120);
    assert.ok(line.includes("…"));
  });
});
