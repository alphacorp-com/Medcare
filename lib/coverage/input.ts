import { COVERAGE_FAMILIES, type CoverageFamily } from "@/lib/coverage/compute";

// Server-side validation of the third-party payment data: payers, conventions, patient
// coverages, prior authorizations, free-care programmes and enrolments, claims, payer
// settlements. Pure, unit-tested in input.test.ts. Every identity / tenant check stays in the
// routes (an id sent here is only checked for its shape).

export type CoverageInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): CoverageInput<T> => ({ ok: true, value });
const fail = <T>(error: string): CoverageInput<T> => ({ ok: false, error });

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null && !Array.isArray(b);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const blank = (v: unknown) => v === undefined || v === null || v === "";
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// Largest amount accepted (FCFA): far above any real invoice, keeps Decimal(14,2) safe.
const MAX_AMOUNT = 1_000_000_000_000;

function text(value: unknown, max: number, required: boolean): string | null | "invalid" {
  if (blank(value)) return required ? "invalid" : null;
  if (typeof value !== "string") return "invalid";
  const t = value.trim();
  if ((required && !t) || t.length > max) return "invalid";
  return t || null;
}

// "YYYY-MM-DD" → UTC midnight.
function day(value: unknown, required: boolean): Date | null | "invalid" {
  if (blank(value)) return required ? "invalid" : null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? "invalid" : d;
}

function amount(value: unknown, { required, positive }: { required: boolean; positive: boolean }): number | null | "invalid" {
  if (blank(value)) return required ? "invalid" : null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < (positive ? 1 : 0) || n > MAX_AMOUNT) return "invalid";
  return n;
}

const rate = (value: unknown, min: number): number | "invalid" => (Number.isInteger(value) && (value as number) >= min && (value as number) <= 100 ? (value as number) : "invalid");

const code = (value: unknown): string | "invalid" => (typeof value === "string" && CODE.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : "invalid");

// Copies the fields a PATCH sends: `partial` lets absent fields through as undefined.
const present = (body: Body, key: string, partial: boolean) => !partial || key in body;

// ── Payers ──────────────────────────────────────────────────────────────────

export interface PayerInput {
  code: string;
  name: string;
  insuranceTypeId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export function parsePayer(body: unknown, { partial }: { partial: boolean }): CoverageInput<Partial<PayerInput>> {
  if (!isBody(body)) return fail("invalid_body");
  const v: Partial<PayerInput> = {};
  if (present(body, "code", partial)) {
    const c = code(body.code);
    if (c === "invalid") return fail("invalid_code");
    v.code = c;
  }
  if (present(body, "name", partial)) {
    const n = text(body.name, 150, true);
    if (n === "invalid" || n === null) return fail("invalid_name");
    v.name = n;
  }
  if (present(body, "insuranceTypeId", partial)) {
    if (!blank(body.insuranceTypeId) && !isUuid(body.insuranceTypeId)) return fail("invalid_insurance_type");
    v.insuranceTypeId = blank(body.insuranceTypeId) ? null : (body.insuranceTypeId as string);
  }
  for (const [key, max] of [["contactName", 150], ["phone", 30], ["email", 150], ["address", 255]] as const) {
    if (!present(body, key, partial)) continue;
    const t = text(body[key], max, false);
    if (t === "invalid") return fail(`invalid_${key}`);
    v[key] = t;
  }
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return fail("invalid_email");
  if (present(body, "isActive", partial)) v.isActive = body.isActive !== false;
  return ok(v);
}

// ── Conventions ─────────────────────────────────────────────────────────────

export interface AgreementInput {
  payerId: string;
  code: string;
  name: string;
  defaultRate: number;
  rates: { family: CoverageFamily; rate: number }[];
  perInvoiceCeiling: number | null;
  annualCeiling: number | null;
  familyAnnualCeiling: number | null;
  childMaxAgeYears: number | null;
  useNomenclatureRates: boolean;
  requiresAuthorization: boolean;
  authorizationThreshold: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
  notes: string | null;
}

export function parseAgreement(body: unknown, { partial }: { partial: boolean }): CoverageInput<Partial<AgreementInput>> {
  if (!isBody(body)) return fail("invalid_body");
  const v: Partial<AgreementInput> = {};
  if (!partial) {
    if (!isUuid(body.payerId)) return fail("invalid_payer");
    v.payerId = body.payerId;
  }
  if (present(body, "code", partial)) {
    const c = code(body.code);
    if (c === "invalid") return fail("invalid_code");
    v.code = c;
  }
  if (present(body, "name", partial)) {
    const n = text(body.name, 150, true);
    if (n === "invalid" || n === null) return fail("invalid_name");
    v.name = n;
  }
  if (present(body, "defaultRate", partial)) {
    const r = rate(body.defaultRate, 0);
    if (r === "invalid") return fail("invalid_rate");
    v.defaultRate = r;
  }
  if (present(body, "rates", partial)) {
    if (!Array.isArray(body.rates)) return fail("invalid_rates");
    const seen = new Set<string>();
    const rates: AgreementInput["rates"] = [];
    for (const entry of body.rates) {
      if (!isBody(entry) || !oneOf(COVERAGE_FAMILIES, entry.family) || seen.has(entry.family)) return fail("invalid_rates");
      const r = rate(entry.rate, 0);
      if (r === "invalid") return fail("invalid_rate");
      seen.add(entry.family);
      rates.push({ family: entry.family, rate: r });
    }
    v.rates = rates;
  }
  for (const key of ["perInvoiceCeiling", "annualCeiling", "familyAnnualCeiling", "authorizationThreshold"] as const) {
    if (!present(body, key, partial)) continue;
    const a = amount(body[key], { required: false, positive: false });
    if (a === "invalid") return fail(`invalid_${key}`);
    v[key] = a;
  }
  if (present(body, "childMaxAgeYears", partial)) {
    if (!blank(body.childMaxAgeYears) && !(Number.isInteger(body.childMaxAgeYears) && (body.childMaxAgeYears as number) >= 1 && (body.childMaxAgeYears as number) <= 99)) return fail("invalid_child_age");
    v.childMaxAgeYears = blank(body.childMaxAgeYears) ? null : (body.childMaxAgeYears as number);
  }
  if (present(body, "useNomenclatureRates", partial)) v.useNomenclatureRates = body.useNomenclatureRates === true;
  if (present(body, "requiresAuthorization", partial)) v.requiresAuthorization = body.requiresAuthorization === true;
  for (const key of ["validFrom", "validTo"] as const) {
    if (!present(body, key, partial)) continue;
    const d = day(body[key], false);
    if (d === "invalid") return fail("invalid_dates");
    v[key] = d;
  }
  if (v.validFrom && v.validTo && v.validFrom > v.validTo) return fail("invalid_dates");
  if (present(body, "isActive", partial)) v.isActive = body.isActive !== false;
  if (present(body, "notes", partial)) {
    const n = text(body.notes, 1000, false);
    if (n === "invalid") return fail("invalid_notes");
    v.notes = n;
  }
  return ok(v);
}

// ── Memberships, beneficiaries and prior authorizations ─────────────────────

export const RELATIONSHIPS = ["holder", "spouse", "child", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface PolicyInput {
  agreementId: string;
  memberNumber: string;
  holderName: string;
  holderPatientId: string | null;
  employer: string | null;
  validFrom: Date;
  validTo: Date | null;
  notes: string | null;
}

export function parsePolicy(body: unknown, { partial }: { partial: boolean }): CoverageInput<Partial<PolicyInput>> {
  if (!isBody(body)) return fail("invalid_body");
  const v: Partial<PolicyInput> = {};
  if (!partial) {
    if (!isUuid(body.agreementId)) return fail("invalid_agreement");
    v.agreementId = body.agreementId;
  }
  if (present(body, "memberNumber", partial)) {
    const m = text(body.memberNumber, 60, true);
    if (m === "invalid" || m === null) return fail("invalid_member_number");
    v.memberNumber = m;
  }
  if (present(body, "holderName", partial)) {
    const h = text(body.holderName, 150, true);
    if (h === "invalid" || h === null) return fail("invalid_holder_name");
    v.holderName = h;
  }
  if (present(body, "holderPatientId", partial)) {
    if (!blank(body.holderPatientId) && !isUuid(body.holderPatientId)) return fail("invalid_holder");
    v.holderPatientId = blank(body.holderPatientId) ? null : (body.holderPatientId as string);
  }
  for (const [key, max] of [["employer", 150], ["notes", 1000]] as const) {
    if (!present(body, key, partial)) continue;
    const t = text(body[key], max, false);
    if (t === "invalid") return fail(`invalid_${key}`);
    v[key] = t;
  }
  if (present(body, "validFrom", partial)) {
    const d = day(body.validFrom, true);
    if (d === "invalid" || d === null) return fail("invalid_dates");
    v.validFrom = d;
  }
  if (present(body, "validTo", partial)) {
    const d = day(body.validTo, false);
    if (d === "invalid") return fail("invalid_dates");
    v.validTo = d;
  }
  if (v.validFrom && v.validTo && v.validFrom > v.validTo) return fail("invalid_dates");
  return ok(v);
}

export interface BeneficiaryInput {
  relationship: Relationship;
  beneficiaryNumber: string | null;
  // Default: the membership's dates.
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
}

export function parseBeneficiary(body: unknown, { partial }: { partial: boolean }): CoverageInput<Partial<BeneficiaryInput>> {
  if (!isBody(body)) return fail("invalid_body");
  const v: Partial<BeneficiaryInput> = {};
  if (present(body, "relationship", partial)) {
    if (!oneOf(RELATIONSHIPS, body.relationship)) return fail("invalid_relationship");
    v.relationship = body.relationship;
  }
  for (const [key, max] of [["beneficiaryNumber", 60], ["notes", 1000]] as const) {
    if (!present(body, key, partial)) continue;
    const t = text(body[key], max, false);
    if (t === "invalid") return fail(`invalid_${key}`);
    v[key] = t;
  }
  for (const key of ["validFrom", "validTo"] as const) {
    if (!present(body, key, partial)) continue;
    const d = day(body[key], false);
    if (d === "invalid") return fail("invalid_dates");
    v[key] = d;
  }
  if (v.validFrom && v.validTo && v.validFrom > v.validTo) return fail("invalid_dates");
  return ok(v);
}

// A beneficiary's dates must lie within the membership's.
export function withinPolicy(b: { validFrom: Date; validTo: Date | null }, policy: { validFrom: Date; validTo: Date | null }): boolean {
  if (b.validFrom < policy.validFrom) return false;
  if (policy.validTo && (!b.validTo || b.validTo > policy.validTo)) return false;
  return true;
}

export interface AuthorizationInput {
  number: string;
  authorizedAmount: number | null;
  validFrom: Date;
  validTo: Date;
  stayId: string | null;
  notes: string | null;
}

export function parseAuthorization(body: unknown): CoverageInput<AuthorizationInput> {
  if (!isBody(body)) return fail("invalid_body");
  const number = text(body.number, 60, true);
  if (number === "invalid" || number === null) return fail("invalid_number");
  const authorizedAmount = amount(body.authorizedAmount, { required: false, positive: true });
  if (authorizedAmount === "invalid") return fail("invalid_amount");
  const validFrom = day(body.validFrom, true);
  const validTo = day(body.validTo, true);
  if (validFrom === "invalid" || validTo === "invalid" || !validFrom || !validTo || validFrom > validTo) return fail("invalid_dates");
  if (!blank(body.stayId) && !isUuid(body.stayId)) return fail("invalid_stay");
  const notes = text(body.notes, 1000, false);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({ number, authorizedAmount, validFrom, validTo, stayId: blank(body.stayId) ? null : (body.stayId as string), notes });
}

// ── Free-care programmes and enrolments ─────────────────────────────────────

export const EXEMPTION_ELIGIBILITIES = ["automatic", "enrolment"] as const;

export interface ProgramInput {
  code: string;
  name: string;
  rate: number;
  families: CoverageFamily[];
  actCodes: string[];
  inventoryItemIds: string[];
  eligibility: (typeof EXEMPTION_ELIGIBILITIES)[number];
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  sex: "M" | "F" | null;
  pregnantOnly: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
  notes: string | null;
}

const months = (value: unknown): number | null | "invalid" => (blank(value) ? null : Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1500 ? (value as number) : "invalid");

export function parseProgram(input: unknown, { partial }: { partial: boolean }): CoverageInput<Partial<ProgramInput>> {
  if (!isBody(input)) return fail("invalid_body");
  let body: Body = input;
  const v: Partial<ProgramInput> = {};
  if (present(body, "code", partial)) {
    const c = code(body.code);
    if (c === "invalid") return fail("invalid_code");
    v.code = c;
  }
  if (present(body, "name", partial)) {
    const n = text(body.name, 150, true);
    if (n === "invalid" || n === null) return fail("invalid_name");
    v.name = n;
  }
  if (present(body, "rate", partial)) {
    const r = rate(body.rate, 1);
    if (r === "invalid") return fail("invalid_rate");
    v.rate = r;
  }
  if (present(body, "families", partial)) {
    if (!Array.isArray(body.families) || body.families.length === 0 || !body.families.every((f) => oneOf(COVERAGE_FAMILIES, f))) return fail("invalid_families");
    v.families = [...new Set(body.families as CoverageFamily[])];
  }
  // Restrictions are optional: none = every line of the families.
  if (!partial) {
    body = { actCodes: [], inventoryItemIds: [], ...body };
  }
  if (present(body, "actCodes", partial)) {
    if (!Array.isArray(body.actCodes) || body.actCodes.length > 200 || !body.actCodes.every((c) => typeof c === "string" && c.trim().length > 0 && c.trim().length <= 60)) return fail("invalid_act_codes");
    v.actCodes = [...new Set((body.actCodes as string[]).map((c) => c.trim()))];
  }
  if (present(body, "inventoryItemIds", partial)) {
    if (!Array.isArray(body.inventoryItemIds) || body.inventoryItemIds.length > 200 || !body.inventoryItemIds.every(isUuid)) return fail("invalid_articles");
    v.inventoryItemIds = [...new Set(body.inventoryItemIds as string[])];
  }
  if (present(body, "eligibility", partial)) {
    if (!oneOf(EXEMPTION_ELIGIBILITIES, body.eligibility)) return fail("invalid_eligibility");
    v.eligibility = body.eligibility;
  }
  for (const key of ["minAgeMonths", "maxAgeMonths"] as const) {
    if (!present(body, key, partial)) continue;
    const m = months(body[key]);
    if (m === "invalid") return fail("invalid_age");
    v[key] = m;
  }
  if (v.minAgeMonths != null && v.maxAgeMonths != null && v.minAgeMonths >= v.maxAgeMonths) return fail("invalid_age");
  if (v.maxAgeMonths === 0) return fail("invalid_age");
  if (present(body, "sex", partial)) {
    if (!blank(body.sex) && body.sex !== "M" && body.sex !== "F") return fail("invalid_sex");
    v.sex = blank(body.sex) ? null : (body.sex as "M" | "F");
  }
  if (present(body, "pregnantOnly", partial)) v.pregnantOnly = body.pregnantOnly === true;
  for (const key of ["validFrom", "validTo"] as const) {
    if (!present(body, key, partial)) continue;
    const d = day(body[key], false);
    if (d === "invalid") return fail("invalid_dates");
    v[key] = d;
  }
  if (v.validFrom && v.validTo && v.validFrom > v.validTo) return fail("invalid_dates");
  if (present(body, "isActive", partial)) v.isActive = body.isActive !== false;
  if (present(body, "notes", partial)) {
    const n = text(body.notes, 1000, false);
    if (n === "invalid") return fail("invalid_notes");
    v.notes = n;
  }
  return ok(v);
}

export interface ExemptionGrantInput {
  programId: string;
  validFrom: Date;
  validTo: Date | null;
  reason: string;
}

export function parseExemptionGrant(body: unknown): CoverageInput<ExemptionGrantInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (!isUuid(body.programId)) return fail("invalid_program");
  const validFrom = day(body.validFrom, true);
  const validTo = day(body.validTo, false);
  if (validFrom === "invalid" || validTo === "invalid" || !validFrom || (validTo && validTo < validFrom)) return fail("invalid_dates");
  // The justification of a free care is mandatory and audited.
  const reason = text(body.reason, 500, true);
  if (reason === "invalid" || reason === null || reason.length < 5) return fail("invalid_reason");
  return ok({ programId: body.programId, validFrom, validTo, reason });
}

// ── Claims and payer settlements ────────────────────────────────────────────

export interface ClaimCreateInput {
  payerId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceIds: string[];
  notes: string | null;
}

export function parseClaimCreate(body: unknown): CoverageInput<ClaimCreateInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (!isUuid(body.payerId)) return fail("invalid_payer");
  const periodStart = day(body.periodStart, true);
  const periodEnd = day(body.periodEnd, true);
  if (periodStart === "invalid" || periodEnd === "invalid" || !periodStart || !periodEnd || periodStart > periodEnd) return fail("invalid_period");
  if (!Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0 || body.invoiceIds.length > 500 || !body.invoiceIds.every(isUuid)) return fail("invalid_invoices");
  const notes = text(body.notes, 1000, false);
  if (notes === "invalid") return fail("invalid_notes");
  return ok({ payerId: body.payerId, periodStart, periodEnd, invoiceIds: [...new Set(body.invoiceIds as string[])], notes });
}

export interface RejectionInput {
  amount: number;
  reason: string;
  chargeToPatient: boolean;
}

export function parseRejection(body: unknown): CoverageInput<RejectionInput> {
  if (!isBody(body)) return fail("invalid_body");
  const a = amount(body.amount, { required: true, positive: true });
  if (a === "invalid" || a === null) return fail("invalid_amount");
  const reason = text(body.reason, 500, true);
  if (reason === "invalid" || reason === null) return fail("invalid_reason");
  return ok({ amount: a, reason, chargeToPatient: body.chargeToPatient === true });
}

export const PAYER_PAYMENT_METHODS = ["bank_transfer", "cheque", "cash", "mobile_money", "other"] as const;

export interface PayerPaymentInput {
  payerId: string;
  claimId: string | null;
  amount: number;
  receivedAt: Date;
  method: (typeof PAYER_PAYMENT_METHODS)[number];
  reference: string | null;
  notes: string | null;
  // Explicit split over claim items; null = allocate automatically (oldest first).
  allocations: { itemId: string; amount: number }[] | null;
}

export function parsePayerPayment(body: unknown, now = new Date()): CoverageInput<PayerPaymentInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (!isUuid(body.payerId)) return fail("invalid_payer");
  if (!blank(body.claimId) && !isUuid(body.claimId)) return fail("invalid_claim");
  const a = amount(body.amount, { required: true, positive: true });
  if (a === "invalid" || a === null) return fail("invalid_amount");
  const receivedAt = day(body.receivedAt, true);
  if (receivedAt === "invalid" || receivedAt === null || receivedAt.getTime() > now.getTime()) return fail("invalid_date");
  if (!oneOf(PAYER_PAYMENT_METHODS, body.method)) return fail("invalid_method");
  const reference = text(body.reference, 120, false);
  const notes = text(body.notes, 1000, false);
  if (reference === "invalid" || notes === "invalid") return fail("invalid_notes");
  let allocations: PayerPaymentInput["allocations"] = null;
  if (!blank(body.allocations)) {
    if (!Array.isArray(body.allocations) || body.allocations.length > 500) return fail("invalid_allocations");
    const seen = new Set<string>();
    allocations = [];
    for (const entry of body.allocations) {
      if (!isBody(entry) || !isUuid(entry.itemId) || seen.has(entry.itemId)) return fail("invalid_allocations");
      const x = amount(entry.amount, { required: true, positive: true });
      if (x === "invalid" || x === null) return fail("invalid_allocations");
      seen.add(entry.itemId);
      allocations.push({ itemId: entry.itemId, amount: x });
    }
    if (allocations.reduce((s, x) => s + x.amount, 0) > a) return fail("allocations_exceed_payment");
  }
  return ok({ payerId: body.payerId, claimId: blank(body.claimId) ? null : (body.claimId as string), amount: a, receivedAt, method: body.method, reference, notes, allocations });
}

// Automatic split of a payer payment: oldest items first, never more than an item's balance.
export function allocateOldestFirst(amountReceived: number, items: readonly { id: string; outstanding: number }[]): { itemId: string; amount: number }[] {
  const out: { itemId: string; amount: number }[] = [];
  let left = amountReceived;
  for (const item of items) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, item.outstanding));
    if (take > 0) {
      out.push({ itemId: item.id, amount: take });
      left -= take;
    }
  }
  return out;
}

export interface PayerRefundInput {
  amount: number;
  refundedAt: Date;
  reference: string | null;
  reason: string;
}

export function parsePayerRefund(body: unknown, now = new Date()): CoverageInput<PayerRefundInput> {
  if (!isBody(body)) return fail("invalid_body");
  const a = amount(body.amount, { required: true, positive: true });
  if (a === "invalid" || a === null) return fail("invalid_amount");
  const refundedAt = day(body.refundedAt, true);
  if (refundedAt === "invalid" || refundedAt === null || refundedAt.getTime() > now.getTime()) return fail("invalid_date");
  const reference = text(body.reference, 120, false);
  if (reference === "invalid") return fail("invalid_reference");
  const reason = text(body.reason, 500, true);
  if (reason === "invalid" || reason === null || reason.length < 5) return fail("invalid_reason");
  return ok({ amount: a, refundedAt, reference, reason });
}

// Reason of a reversal / cancellation (mandatory, audited).
export function parseReason(body: unknown): CoverageInput<string> {
  if (!isBody(body)) return fail("invalid_body");
  const reason = text(body.reason, 500, true);
  if (reason === "invalid" || reason === null || reason.length < 5) return fail("invalid_reason");
  return ok(reason);
}

// ── Patient overpayments ────────────────────────────────────────────────────

export const REFUND_METHODS = ["cash", "card", "bank_transfer", "mobile_money_orange", "mobile_money_mtn"] as const;

export type PatientRefundInput =
  | { kind: "refund"; amount: number; method: (typeof REFUND_METHODS)[number]; reference: string | null; reason: string; refundedAt: Date }
  | { kind: "transfer"; amount: number; targetInvoiceId: string; reason: string; refundedAt: Date };

export function parsePatientRefund(body: unknown, now = new Date()): CoverageInput<PatientRefundInput> {
  if (!isBody(body)) return fail("invalid_body");
  const a = amount(body.amount, { required: true, positive: true });
  if (a === "invalid" || a === null) return fail("invalid_amount");
  const reason = text(body.reason, 500, true);
  if (reason === "invalid" || reason === null || reason.length < 5) return fail("invalid_reason");
  // Recorded at the moment it is entered unless a past day is given.
  const refundedAt = blank(body.refundedAt) ? now : day(body.refundedAt, true);
  if (refundedAt === "invalid" || refundedAt === null || refundedAt.getTime() > now.getTime()) return fail("invalid_date");
  if (body.kind === "refund") {
    if (!oneOf(REFUND_METHODS, body.method)) return fail("invalid_method");
    const reference = text(body.reference, 120, false);
    if (reference === "invalid") return fail("invalid_reference");
    return ok({ kind: "refund", amount: a, method: body.method, reference, reason, refundedAt });
  }
  if (body.kind === "transfer") {
    if (!isUuid(body.targetInvoiceId)) return fail("invalid_target_invoice");
    return ok({ kind: "transfer", amount: a, targetInvoiceId: body.targetInvoiceId, reason, refundedAt });
  }
  return fail("invalid_kind");
}

// What can be given back on an invoice: what the patient paid beyond their share (all of it on
// a cancelled invoice).
export function refundableAmount(invoice: { status: string; paidAmount: number; patientAmount: number }): number {
  return Math.max(0, invoice.paidAmount - (invoice.status === "cancelled" ? 0 : invoice.patientAmount));
}

// Nomenclature coverage rate of a medical act (MedicalAct.defaultPecCoveragePercent): a whole
// percentage, or blank for "not set" (the convention's family rate then applies).
export function parseNomenclatureRate(value: unknown): number | null | "invalid" {
  if (blank(value)) return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : "invalid";
}
