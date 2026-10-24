import { parseEventDate } from "@/lib/maternity/input";

// Server-side validation of the blood bank (RMA3 V.6): donors, mobile collections,
// donations (bags) and what becomes of a bag. Pure, unit-tested in input.test.ts.

export type BloodInput<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): BloodInput<T> => ({ ok: true, value });
const fail = <T>(error: string): BloodInput<T> => ({ ok: false, error });

type Body = Record<string, unknown>;
const isBody = (b: unknown): b is Body => typeof b === "object" && b !== null && !Array.isArray(b);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9._/-]{1,40}$/;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const DONOR_TYPES = ["voluntary", "family"] as const;
export const TEST_RESULTS = ["not_done", "negative", "positive", "indeterminate"] as const;
type TestResult = (typeof TEST_RESULTS)[number];

export interface DonorInput {
  code: string;
  fullName: string;
  sex: "M" | "F";
  birthDate: Date | null;
  phone: string | null;
  bloodGroup: (typeof BLOOD_GROUPS)[number] | null;
  donorType: (typeof DONOR_TYPES)[number];
  patientId: string | null;
}

export function parseDonor(body: unknown, now = new Date()): BloodInput<DonorInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.code !== "string" || !CODE.test(body.code.trim())) return fail("invalid_code");
  if (typeof body.fullName !== "string" || !body.fullName.trim() || body.fullName.trim().length > 150) return fail("invalid_name");
  if (body.sex !== "M" && body.sex !== "F") return fail("invalid_sex");
  let birthDate: Date | null = null;
  if (body.birthDate !== undefined && body.birthDate !== null && body.birthDate !== "") {
    const d = parseEventDate(body.birthDate, now, null);
    if (d === "invalid" || d === null) return fail("invalid_birth_date");
    birthDate = d;
  }
  let phone: string | null = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
    if (typeof body.phone !== "string" || !/^\+?[0-9 ().-]{6,30}$/.test(body.phone.trim())) return fail("invalid_phone");
    phone = body.phone.trim();
  }
  const bloodGroup = body.bloodGroup === undefined || body.bloodGroup === null || body.bloodGroup === "" ? null : body.bloodGroup;
  if (bloodGroup !== null && !oneOf(BLOOD_GROUPS, bloodGroup)) return fail("invalid_blood_group");
  if (!oneOf(DONOR_TYPES, body.donorType)) return fail("invalid_donor_type");
  const patientId = body.patientId === undefined || body.patientId === null || body.patientId === "" ? null : body.patientId;
  if (patientId !== null && (typeof patientId !== "string" || !UUID.test(patientId))) return fail("invalid_patient");
  return ok({ code: body.code.trim().toUpperCase(), fullName: body.fullName.trim(), sex: body.sex, birthDate, phone, bloodGroup, donorType: body.donorType, patientId });
}

export interface SessionInput {
  heldAt: Date;
  location: string;
}

export function parseCollectionSession(body: unknown, now = new Date()): BloodInput<SessionInput> {
  if (!isBody(body)) return fail("invalid_body");
  const heldAt = parseEventDate(body.heldAt, now);
  if (heldAt === "invalid" || heldAt === null) return fail("invalid_date");
  if (typeof body.location !== "string" || !body.location.trim() || body.location.trim().length > 150) return fail("invalid_location");
  return ok({ heldAt, location: body.location.trim() });
}

export interface DonationInput {
  donorId: string;
  sessionId: string | null;
  bagNumber: string;
  collectedAt: Date;
  hivResult: TestResult;
  hbvResult: TestResult;
  hcvResult: TestResult;
  syphilisResult: TestResult;
}

function testResults(body: Body): BloodInput<Pick<DonationInput, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult">> {
  const value = {} as Pick<DonationInput, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult">;
  for (const field of ["hivResult", "hbvResult", "hcvResult", "syphilisResult"] as const) {
    const result = body[field] ?? "not_done";
    if (!oneOf(TEST_RESULTS, result)) return fail(`invalid_${field}`);
    value[field] = result;
  }
  return ok(value);
}

export function parseDonation(body: unknown, now = new Date()): BloodInput<DonationInput> {
  if (!isBody(body)) return fail("invalid_body");
  if (typeof body.donorId !== "string" || !UUID.test(body.donorId)) return fail("invalid_donor");
  const sessionId = body.sessionId === undefined || body.sessionId === null || body.sessionId === "" ? null : body.sessionId;
  if (sessionId !== null && (typeof sessionId !== "string" || !UUID.test(sessionId))) return fail("invalid_session");
  if (typeof body.bagNumber !== "string" || !CODE.test(body.bagNumber.trim())) return fail("invalid_bag_number");
  const collectedAt = parseEventDate(body.collectedAt, now);
  if (collectedAt === "invalid" || collectedAt === null) return fail("invalid_date");
  const tests = testResults(body);
  if (!tests.ok) return tests;
  return ok({ donorId: body.donorId, sessionId, bagNumber: body.bagNumber.trim().toUpperCase(), collectedAt, ...tests.value });
}

// What happens to a bag after collection: test results, available, served, transfused,
// destroyed. A bag with a positive or indeterminate test can only be destroyed.
export type BagUpdate =
  | { action: "tests"; results: Pick<DonationInput, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult"> }
  | { action: "release" }
  | { action: "serve"; at: Date }
  | { action: "transfuse"; at: Date; recipientPatientId: string | null }
  | { action: "destroy"; at: Date; reason: string };

export interface BagState {
  status: string;
  collectedAt: Date;
  hivResult: string;
  hbvResult: string;
  hcvResult: string;
  syphilisResult: string;
}

const RESULTS_OF = (s: Pick<BagState, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult">) => [s.hivResult, s.hbvResult, s.hcvResult, s.syphilisResult];
export const isFullyTested = (s: Pick<BagState, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult">) => RESULTS_OF(s).every((r) => r !== "not_done");
export const isReactive = (s: Pick<BagState, "hivResult" | "hbvResult" | "hcvResult" | "syphilisResult">) => RESULTS_OF(s).some((r) => r === "positive" || r === "indeterminate");

export function parseBagUpdate(body: unknown, bag: BagState, now = new Date()): BloodInput<BagUpdate> {
  if (!isBody(body)) return fail("invalid_body");
  const at = () => {
    const d = parseEventDate(body.at, now);
    return d === "invalid" || d === null || d < bag.collectedAt ? null : d;
  };
  switch (body.action) {
    case "tests": {
      if (bag.status !== "quarantine") return fail("bag_not_in_quarantine");
      const results = testResults(body);
      return results.ok ? ok({ action: "tests", results: results.value }) : results;
    }
    case "release":
      if (bag.status !== "quarantine") return fail("bag_not_in_quarantine");
      // Only a bag tested negative for the four markers can be used.
      if (!isFullyTested(bag) || isReactive(bag)) return fail("bag_not_safe");
      return ok({ action: "release" });
    case "serve": {
      if (bag.status !== "available") return fail("bag_not_available");
      const d = at();
      return d ? ok({ action: "serve", at: d }) : fail("invalid_date");
    }
    case "transfuse": {
      if (bag.status !== "available" && bag.status !== "served") return fail("bag_not_available");
      const d = at();
      if (!d) return fail("invalid_date");
      const recipient = body.recipientPatientId === undefined || body.recipientPatientId === null || body.recipientPatientId === "" ? null : body.recipientPatientId;
      if (recipient !== null && (typeof recipient !== "string" || !UUID.test(recipient))) return fail("invalid_patient");
      return ok({ action: "transfuse", at: d, recipientPatientId: recipient });
    }
    case "destroy": {
      if (bag.status === "transfused" || bag.status === "destroyed") return fail("bag_already_used");
      const d = at();
      if (!d) return fail("invalid_date");
      if (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 200) return fail("invalid_reason");
      return ok({ action: "destroy", at: d, reason: body.reason.trim() });
    }
    default:
      return fail("invalid_action");
  }
}
