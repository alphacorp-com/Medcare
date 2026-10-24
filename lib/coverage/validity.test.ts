import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ageInYears, beneficiaryValidity, type BeneficiaryTerms } from "@/lib/coverage/validity";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const at = new Date("2026-10-24T10:00:00Z");
const terms = (o: Partial<BeneficiaryTerms> = {}, agreement: Partial<BeneficiaryTerms["agreement"]> = {}, policy: Partial<BeneficiaryTerms["policy"]> = {}): BeneficiaryTerms => ({
  relationship: "holder",
  validFrom: d("2026-01-01"),
  validTo: null,
  endedAt: null,
  ...o,
  policy: { validFrom: d("2026-01-01"), validTo: null, endedAt: null, ...policy },
  agreement: { isActive: true, validFrom: null, validTo: null, childMaxAgeYears: null, payerActive: true, ...agreement },
});
const adultBirth = d("1985-03-10");

describe("beneficiary validity", () => {
  it("is valid when the beneficiary, the membership and the convention are", () => {
    assert.deepEqual(beneficiaryValidity(terms(), adultBirth, at), { valid: true });
  });
  it("a dependant loses the coverage when the holder's membership ends, even if their own line is open", () => {
    assert.deepEqual(beneficiaryValidity(terms({ relationship: "child" }, {}, { endedAt: new Date("2026-10-01T08:00:00Z") }), d("2015-05-05"), at), { valid: false, reason: "membership" });
    assert.deepEqual(beneficiaryValidity(terms({ relationship: "spouse" }, {}, { validTo: d("2026-09-30") }), adultBirth, at), { valid: false, reason: "membership" });
  });
  it("respects the beneficiary's own dates and removal", () => {
    assert.deepEqual(beneficiaryValidity(terms({ validFrom: d("2026-11-01") }), adultBirth, at), { valid: false, reason: "beneficiary" });
    assert.deepEqual(beneficiaryValidity(terms({ endedAt: new Date("2026-10-24T09:00:00Z") }), adultBirth, at), { valid: false, reason: "beneficiary" });
    // Removed later than the invoice: still covered for it.
    assert.deepEqual(beneficiaryValidity(terms({ endedAt: new Date("2026-10-25T09:00:00Z") }), adultBirth, at), { valid: true });
  });
  it("needs an active convention and payer in force", () => {
    assert.deepEqual(beneficiaryValidity(terms({}, { payerActive: false }), adultBirth, at), { valid: false, reason: "convention" });
    assert.deepEqual(beneficiaryValidity(terms({}, { validTo: d("2026-06-30") }), adultBirth, at), { valid: false, reason: "convention" });
  });
  it("stops covering a child dependant at the age limit (birthday counted on the day)", () => {
    const limit = { childMaxAgeYears: 21 };
    assert.deepEqual(beneficiaryValidity(terms({ relationship: "child" }, limit), d("2005-10-25"), at), { valid: true }); // 20, birthday tomorrow
    assert.deepEqual(beneficiaryValidity(terms({ relationship: "child" }, limit), d("2005-10-24"), at), { valid: false, reason: "age_limit" }); // 21 today
    // The limit is for children only.
    assert.deepEqual(beneficiaryValidity(terms({ relationship: "spouse" }, limit), d("1990-01-01"), at), { valid: true });
  });
  it("computes ages in whole years", () => {
    assert.equal(ageInYears(d("2005-10-24"), d("2026-10-24")), 21);
    assert.equal(ageInYears(d("2005-10-25"), d("2026-10-24")), 20);
    assert.equal(ageInYears(d("2008-02-29"), d("2026-02-28")), 17);
  });
});
