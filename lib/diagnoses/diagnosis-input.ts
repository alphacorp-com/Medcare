import { normalizeIcd10Code } from "@/lib/diagnoses/icd10-ranges";

// Validation of the diagnoses a client sends with a consultation or a discharge.
// Pure (no database), unit-tested in diagnosis-input.test.ts. Codes are only checked for
// shape here; lib/diagnoses/diagnoses.ts then requires them to exist in the tenant's
// ICD-10 catalog and takes the label from there, never from the client.

export const MAX_DIAGNOSES = 10;

export interface DiagnosisInput {
  code: string;
  kind: "principal" | "secondary";
  isNewCase: boolean;
}

export type DiagnosisInputError =
  | "not_a_list"
  | "too_many"
  | "invalid_entry"
  | "invalid_code"
  | "principal_required"
  | "single_principal"
  | "duplicate_code";

export type DiagnosisInputResult = { ok: true; value: DiagnosisInput[] } | { ok: false; error: DiagnosisInputError };

export function parseDiagnosisInput(input: unknown, { principalRequired }: { principalRequired: boolean }): DiagnosisInputResult {
  if (input === undefined || input === null) {
    return principalRequired ? { ok: false, error: "principal_required" } : { ok: true, value: [] };
  }
  if (!Array.isArray(input)) return { ok: false, error: "not_a_list" };
  if (input.length > MAX_DIAGNOSES) return { ok: false, error: "too_many" };

  const value: DiagnosisInput[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return { ok: false, error: "invalid_entry" };
    const raw = entry as { code?: unknown; kind?: unknown; isNewCase?: unknown };
    const code = normalizeIcd10Code(raw.code);
    if (!code) return { ok: false, error: "invalid_code" };
    if (raw.kind !== "principal" && raw.kind !== "secondary") return { ok: false, error: "invalid_entry" };
    if (seen.has(code)) return { ok: false, error: "duplicate_code" };
    seen.add(code);
    value.push({ code, kind: raw.kind, isNewCase: raw.isNewCase === undefined ? true : raw.isNewCase === true });
  }

  const principals = value.filter((d) => d.kind === "principal").length;
  if (principals > 1) return { ok: false, error: "single_principal" };
  if (value.length > 0 && principals === 0) return { ok: false, error: "principal_required" };
  if (principalRequired && principals === 0) return { ok: false, error: "principal_required" };
  return { ok: true, value };
}
