import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateOldestFirst, parseAgreement, parseAuthorization, parseBeneficiary, parseClaimCreate, parseExemptionGrant, parseNomenclatureRate, parsePatientRefund, parsePayer,
  parsePayerPayment, parsePayerRefund, parsePolicy, parseProgram, parseReason, parseRejection, refundableAmount, withinPolicy,
} from "@/lib/coverage/input";

const id = "3f6c1d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";
const id2 = "4f6c1d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";
const now = new Date("2026-10-24T12:00:00Z");

describe("payers and conventions", () => {
  it("normalises the code and checks the email", () => {
    assert.deepEqual(parsePayer({ code: " cnps ", name: "CNPS" }, { partial: false }), { ok: true, value: { code: "CNPS", name: "CNPS", insuranceTypeId: null, contactName: null, phone: null, email: null, address: null, isActive: true } });
    assert.deepEqual(parsePayer({ code: "X", name: "A" }, { partial: false }), { ok: false, error: "invalid_code" });
    assert.deepEqual(parsePayer({ email: "nope" }, { partial: true }), { ok: false, error: "invalid_email" });
    assert.deepEqual(parsePayer({ name: "B" }, { partial: true }), { ok: true, value: { name: "B" } });
  });
  it("validates rates, families, ceilings and dates", () => {
    const base = { payerId: id, code: "CNPS-STD", name: "Standard", defaultRate: 80, rates: [{ family: "pharmacy", rate: 50 }] };
    assert.equal(parseAgreement(base, { partial: false }).ok, true);
    assert.deepEqual(parseAgreement({ ...base, defaultRate: 120 }, { partial: false }), { ok: false, error: "invalid_rate" });
    assert.deepEqual(parseAgreement({ ...base, rates: [{ family: "pharmacy", rate: 50 }, { family: "pharmacy", rate: 60 }] }, { partial: false }), { ok: false, error: "invalid_rates" });
    assert.deepEqual(parseAgreement({ ...base, rates: [{ family: "dental", rate: 50 }] }, { partial: false }), { ok: false, error: "invalid_rates" });
    assert.deepEqual(parseAgreement({ ...base, annualCeiling: -1 }, { partial: false }), { ok: false, error: "invalid_annualCeiling" });
    assert.deepEqual(parseAgreement({ ...base, validFrom: "2026-12-01", validTo: "2026-01-01" }, { partial: false }), { ok: false, error: "invalid_dates" });
    assert.deepEqual(parseAgreement({ ...base, validFrom: "2026-02-30" }, { partial: false }), { ok: false, error: "invalid_dates" });
  });
});

describe("patient coverage and authorization", () => {
  it("requires the convention, member number and start date", () => {
    const policy = { agreementId: id, memberNumber: "123", holderName: "Mbezele Arsène", validFrom: "2026-01-01" };
    assert.equal(parsePolicy(policy, { partial: false }).ok, true);
    assert.deepEqual(parsePolicy({ ...policy, memberNumber: " " }, { partial: false }), { ok: false, error: "invalid_member_number" });
    assert.deepEqual(parsePolicy({ ...policy, agreementId: "x" }, { partial: false }), { ok: false, error: "invalid_agreement" });
    assert.deepEqual(parsePolicy({ ...policy, holderName: "" }, { partial: false }), { ok: false, error: "invalid_holder_name" });
    assert.deepEqual(parsePolicy({ ...policy, holderPatientId: "nope" }, { partial: false }), { ok: false, error: "invalid_holder" });
  });
  it("validates beneficiaries and keeps them within the membership", () => {
    assert.deepEqual(parseBeneficiary({ relationship: "child", beneficiaryNumber: "03" }, { partial: true }), { ok: true, value: { relationship: "child", beneficiaryNumber: "03" } });
    assert.deepEqual(parseBeneficiary({ relationship: "cousin" }, { partial: true }), { ok: false, error: "invalid_relationship" });
    const membership = { validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31") };
    assert.equal(withinPolicy({ validFrom: new Date("2026-03-01"), validTo: new Date("2026-06-30") }, membership), true);
    assert.equal(withinPolicy({ validFrom: new Date("2025-12-01"), validTo: null }, membership), false);
    // An open-ended dependant on a membership that ends would outlive it.
    assert.equal(withinPolicy({ validFrom: new Date("2026-03-01"), validTo: null }, membership), false);
    assert.equal(withinPolicy({ validFrom: new Date("2026-03-01"), validTo: null }, { validFrom: membership.validFrom, validTo: null }), true);
  });
  it("checks the authorization amount and validity", () => {
    assert.equal(parseAuthorization({ number: "BON-1", authorizedAmount: 50000, validFrom: "2026-10-01", validTo: "2026-10-31" }).ok, true);
    assert.deepEqual(parseAuthorization({ number: "BON-1", authorizedAmount: 0, validFrom: "2026-10-01", validTo: "2026-10-31" }), { ok: false, error: "invalid_amount" });
    assert.deepEqual(parseAuthorization({ number: "BON-1", validFrom: "2026-10-31", validTo: "2026-10-01" }), { ok: false, error: "invalid_dates" });
  });
});

describe("free-care programmes", () => {
  it("validates families, ages and the enrolment reason", () => {
    const base = { code: "PALU5", name: "Paludisme < 5 ans", rate: 100, families: ["laboratory", "pharmacy"], eligibility: "automatic", maxAgeMonths: 60 };
    assert.equal(parseProgram(base, { partial: false }).ok, true);
    assert.deepEqual(parseProgram({ ...base, families: [] }, { partial: false }), { ok: false, error: "invalid_families" });
    assert.deepEqual(parseProgram({ ...base, rate: 0 }, { partial: false }), { ok: false, error: "invalid_rate" });
    assert.deepEqual(parseProgram({ ...base, minAgeMonths: 60, maxAgeMonths: 12 }, { partial: false }), { ok: false, error: "invalid_age" });
    assert.deepEqual(parseProgram({ ...base, inventoryItemIds: ["coartem"] }, { partial: false }), { ok: false, error: "invalid_articles" });
    assert.deepEqual(parseExemptionGrant({ programId: id, validFrom: "2026-10-01", reason: "ok" }), { ok: false, error: "invalid_reason" });
    assert.equal(parseExemptionGrant({ programId: id, validFrom: "2026-10-01", reason: "Enquête sociale n°12" }).ok, true);
  });
});

describe("nomenclature, refunds and reversals", () => {
  it("validates the nomenclature rate of an act", () => {
    assert.equal(parseNomenclatureRate(""), null);
    assert.equal(parseNomenclatureRate(null), null);
    assert.equal(parseNomenclatureRate("70"), 70);
    assert.equal(parseNomenclatureRate(0), 0);
    assert.equal(parseNomenclatureRate(101), "invalid");
    assert.equal(parseNomenclatureRate("12.5"), "invalid");
  });
  it("validates patient refunds and transfers, and what can be refunded", () => {
    assert.equal(parsePatientRefund({ kind: "refund", amount: 2000, method: "cash", reason: "Prise en charge tardive" }, now).ok, true);
    assert.deepEqual(parsePatientRefund({ kind: "refund", amount: 2000, method: "insurance", reason: "Prise en charge tardive" }, now), { ok: false, error: "invalid_method" });
    assert.deepEqual(parsePatientRefund({ kind: "transfer", amount: 2000, reason: "Report sur facture" }, now), { ok: false, error: "invalid_target_invoice" });
    assert.deepEqual(parsePatientRefund({ kind: "refund", amount: 2000, method: "cash", reason: "ok" }, now), { ok: false, error: "invalid_reason" });
    assert.deepEqual(parsePatientRefund({ kind: "gift", amount: 2000, reason: "Prise en charge" }, now), { ok: false, error: "invalid_kind" });
    assert.equal(refundableAmount({ status: "paid", paidAmount: 10000, patientAmount: 2000 }), 8000);
    assert.equal(refundableAmount({ status: "partially_paid", paidAmount: 1000, patientAmount: 2000 }), 0);
    assert.equal(refundableAmount({ status: "cancelled", paidAmount: 3000, patientAmount: 2000 }), 3000);
  });
  it("validates payer refunds and reversal reasons", () => {
    assert.equal(parsePayerRefund({ amount: 5000, refundedAt: "2026-10-20", reason: "Trop-versé AXA" }, now).ok, true);
    assert.deepEqual(parsePayerRefund({ amount: 5000, refundedAt: "2026-11-20", reason: "Trop-versé AXA" }, now), { ok: false, error: "invalid_date" });
    assert.deepEqual(parseReason({ reason: "abc" }), { ok: false, error: "invalid_reason" });
    assert.deepEqual(parseReason({ reason: "Erreur de saisie" }), { ok: true, value: "Erreur de saisie" });
  });
});

describe("claims and settlements", () => {
  it("validates a claim, a rejection and a settlement", () => {
    assert.equal(parseClaimCreate({ payerId: id, periodStart: "2026-09-01", periodEnd: "2026-09-30", invoiceIds: [id2, id2] }).ok, true);
    assert.deepEqual(parseClaimCreate({ payerId: id, periodStart: "2026-09-01", periodEnd: "2026-09-30", invoiceIds: [] }), { ok: false, error: "invalid_invoices" });
    assert.deepEqual(parseRejection({ amount: 0, reason: "x" }), { ok: false, error: "invalid_amount" });
    const pay = { payerId: id, amount: 10000, receivedAt: "2026-10-20", method: "bank_transfer" };
    assert.equal(parsePayerPayment(pay, now).ok, true);
    assert.deepEqual(parsePayerPayment({ ...pay, receivedAt: "2026-11-02" }, now), { ok: false, error: "invalid_date" });
    assert.deepEqual(parsePayerPayment({ ...pay, allocations: [{ itemId: id2, amount: 12000 }] }, now), { ok: false, error: "allocations_exceed_payment" });
    assert.deepEqual(parsePayerPayment({ ...pay, method: "insurance" }, now), { ok: false, error: "invalid_method" });
  });
  it("allocates the oldest items first within the balance", () => {
    assert.deepEqual(allocateOldestFirst(7000, [{ id: "a", outstanding: 5000 }, { id: "b", outstanding: 0 }, { id: "c", outstanding: 4000 }]), [{ itemId: "a", amount: 5000 }, { itemId: "c", amount: 2000 }]);
    assert.deepEqual(allocateOldestFirst(100, []), []);
  });
});
