// Turns raw AuditLog rows into readable, translated text. Pure functions over a translator
// (the `audit` namespace of next-intl) so they're unit-tested
// (components/shared/audit-format.test.ts) and shared by the dashboard card and the
// per-user activity page.

export interface AuditTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

// Audit codes double as nested translation paths ("user.login" → actions.user.login).
// Anything outside this charset is never used as a key, so a malformed code can't make
// next-intl resolve an unrelated message.
const CODE_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const FIELD_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const MAX_VALUE_LENGTH = 80;

export function auditActionLabel(code: string, t: AuditTranslator): string {
  const key = `actions.${code}`;
  if (CODE_RE.test(code) && t.has(key)) return t(key);
  // A code added without a translation yet: show it readably rather than as a raw key.
  return t("unknown_action", { code: code.replace(/[._]/g, " ") });
}

export function auditActorLabel(name: string | null | undefined, actorType: string | null | undefined, t: AuditTranslator): string {
  if (name) return name;
  return actorType === "system" ? t("system_actor") : t("unknown_actor");
}

function fieldLabel(field: string, t: AuditTranslator): string {
  const key = `fields.${field}`;
  return FIELD_RE.test(field) && t.has(key) ? t(key) : field;
}

function displayValue(value: unknown, t: AuditTranslator): string | null {
  if (typeof value === "boolean") return t(value ? "details.yes" : "details.no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_VALUE_LENGTH ? `${trimmed.slice(0, MAX_VALUE_LENGTH - 1)}…` : trimmed;
  }
  return null;
}

// One readable line per meaningful payload entry. Technical ids (stayId, subscriptionId…)
// and unknown nested structures are deliberately skipped: they mean nothing to the reader.
export function auditDetailLines(payload: unknown, t: AuditTranslator): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const lines: string[] = [];

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    // { roleChanged: { from, to } } → "Role: Nurse → Doctor"
    if (key.endsWith("Changed") && value && typeof value === "object" && "from" in value && "to" in value) {
      const field = fieldLabel(key.slice(0, -"Changed".length), t);
      const { from, to } = value as { from: unknown; to: unknown };
      const fromText = displayValue(from, t);
      const toText = displayValue(to, t);
      lines.push(
        fromText !== null && toText !== null
          ? t("details.changed", { field, from: fromText, to: toText })
          : t("details.updated", { field })
      );
      continue;
    }

    switch (key) {
      case "fields": {
        if (Array.isArray(value) && value.length > 0) {
          const names = value.filter((f): f is string => typeof f === "string").map((f) => fieldLabel(f, t));
          if (names.length > 0) lines.push(t("details.fields", { fields: names.join(", ") }));
        }
        break;
      }
      case "reason":
      case "email":
      case "role":
      case "name":
      case "deletedFullName":
      case "deletedEmail": {
        const text = displayValue(value, t);
        if (text !== null) lines.push(t(`details.${key}`, { value: text }));
        break;
      }
      default:
        break;
    }
  }
  return lines;
}
