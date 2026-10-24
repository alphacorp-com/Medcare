import { STAFF_CADRES_BY_CODE } from "@/lib/hr/cadres";

// Server-side validation of the staff register (RMA3 VI.5). Pure, unit-tested in input.test.ts.

export type HrInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): HrInput<T> => ({ ok: true, value });
const fail = <T>(error: string): HrInput<T> => ({ ok: false, error });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StaffMemberInput {
  fullName: string;
  sex: "M" | "F";
  cadre: string;
  payer: "state" | "local";
  inPost: boolean;
  birthDate: Date | null;
  hiredAt: Date | null;
  retirementDate: Date | null;
  leftAt: Date | null;
  tenantUserId: string | null;
  notes: string | null;
}

function optionalDate(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE.test(value)) return "invalid";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

// Creation: every field; update (`partial`): only the fields present.
export function parseStaffMember(body: unknown, { partial }: { partial: boolean }): HrInput<Partial<StaffMemberInput>> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("invalid_body");
  const b = body as Record<string, unknown>;
  const has = (k: string) => !partial || b[k] !== undefined;
  const value: Partial<StaffMemberInput> = {};

  if (has("fullName")) {
    if (typeof b.fullName !== "string" || !b.fullName.trim() || b.fullName.trim().length > 150) return fail("invalid_name");
    value.fullName = b.fullName.trim();
  }
  if (has("sex")) {
    if (b.sex !== "M" && b.sex !== "F") return fail("invalid_sex");
    value.sex = b.sex;
  }
  if (has("cadre")) {
    if (typeof b.cadre !== "string" || !STAFF_CADRES_BY_CODE.has(b.cadre)) return fail("invalid_cadre");
    value.cadre = b.cadre;
  }
  if (has("payer")) {
    if (b.payer !== "state" && b.payer !== "local") return fail("invalid_payer");
    value.payer = b.payer;
  }
  if (b.inPost !== undefined || !partial) value.inPost = b.inPost === undefined ? true : b.inPost === true;
  for (const field of ["birthDate", "hiredAt", "retirementDate", "leftAt"] as const) {
    if (b[field] === undefined && partial) continue;
    const date = optionalDate(b[field]);
    if (date === "invalid") return fail(`invalid_${field}`);
    value[field] = date;
  }
  if (value.birthDate && value.retirementDate && value.retirementDate <= value.birthDate) return fail("invalid_retirementDate");
  if (value.hiredAt && value.leftAt && value.leftAt < value.hiredAt) return fail("invalid_leftAt");
  if (b.tenantUserId !== undefined || !partial) {
    const id = b.tenantUserId;
    if (id === undefined || id === null || id === "") value.tenantUserId = null;
    else if (typeof id !== "string" || !UUID.test(id)) return fail("invalid_user");
    else value.tenantUserId = id;
  }
  if (b.notes !== undefined || !partial) {
    const notes = b.notes;
    if (notes === undefined || notes === null || notes === "") value.notes = null;
    else if (typeof notes !== "string" || notes.length > 1000) return fail("invalid_notes");
    else value.notes = notes.trim() || null;
  }
  return ok(value);
}
