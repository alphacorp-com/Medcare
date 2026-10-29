import { test } from "node:test";
import assert from "node:assert/strict";
import {
  overlaps, parseAsaScore, parseComplications, parseDate, parseDuration, parseOperativeTimes, parseOptionalText, parseRequiredText, parseSupplies, parseTeam, startBlockers,
} from "./validation";

test("ASA score: 1 to 6, empty means not given", () => {
  assert.deepEqual(parseAsaScore(""), { ok: true, value: null });
  assert.deepEqual(parseAsaScore(undefined), { ok: true, value: null });
  assert.deepEqual(parseAsaScore("3"), { ok: true, value: 3 });
  for (const bad of ["0", "7", "2.5", "abc", -1]) assert.equal(parseAsaScore(bad).ok, false, String(bad));
});

test("dates must parse", () => {
  assert.equal(parseDate("2026-11-02T08:30", "scheduledAt").ok, true);
  for (const bad of ["", "tomorrow", null, undefined, {}]) assert.equal(parseDate(bad, "scheduledAt").ok, false, String(bad));
});

test("complications: known keys, deduplicated, 'none' alone", () => {
  assert.deepEqual(parseComplications(["bleeding", "bleeding", "infection"]), { ok: true, value: ["bleeding", "infection"] });
  assert.deepEqual(parseComplications(undefined), { ok: true, value: [] });
  assert.equal(parseComplications(["fracture"]).ok, false);
  assert.equal(parseComplications(["none", "bleeding"]).ok, false);
  assert.equal(parseComplications("bleeding").ok, false);
  assert.equal(parseComplications([{ cancelReason: "x" }]).ok, false);
});

test("text fields are trimmed and bounded", () => {
  assert.deepEqual(parseOptionalText("  ", "x", 5), { ok: true, value: null });
  assert.deepEqual(parseOptionalText(" ab ", "x", 5), { ok: true, value: "ab" });
  assert.equal(parseOptionalText("abcdef", "x", 5).ok, false);
  assert.equal(parseOptionalText(42, "x", 5).ok, false);
  assert.equal(parseRequiredText("", "x", 5).ok, false);
  assert.deepEqual(parseRequiredText("ok", "x", 5), { ok: true, value: "ok" });
});


const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

test("team: known roles, valid ids, duplicates dropped", () => {
  assert.deepEqual(parseTeam([{ userId: U1, role: "scrub_nurse" }, { userId: U1, role: "scrub_nurse" }, { userId: U2, role: "assistant_surgeon" }]), {
    ok: true,
    value: [{ userId: U1, role: "scrub_nurse" }, { userId: U2, role: "assistant_surgeon" }],
  });
  assert.equal(parseTeam([{ userId: "x", role: "scrub_nurse" }]).ok, false);
  assert.equal(parseTeam([{ userId: U1, role: "janitor" }]).ok, false);
});

test("duration: 5 minutes to 24 hours, empty means default", () => {
  assert.deepEqual(parseDuration(""), { ok: true, value: null });
  assert.deepEqual(parseDuration("120"), { ok: true, value: 120 });
  for (const bad of ["0", "4", "1441", "1.5", "abc"]) assert.equal(parseDuration(bad).ok, false, bad);
});

test("operative times: in order, after the start, not in the future", () => {
  const started = new Date("2026-10-29T08:00:00Z");
  const now = new Date("2026-10-29T12:00:00Z");
  const ok = parseOperativeTimes({ anesthesiaStartAt: "2026-10-29T07:50:00Z", incisionAt: "2026-10-29T08:10:00Z", closureAt: "2026-10-29T09:30:00Z" }, started, now);
  assert.equal(ok.ok, true);
  assert.equal(parseOperativeTimes({ incisionAt: "2026-10-29T09:00:00Z", closureAt: "2026-10-29T08:30:00Z" }, started, now).ok, false, "closure before incision");
  assert.equal(parseOperativeTimes({ closureAt: "2026-10-29T13:00:00Z" }, started, now).ok, false, "future");
  assert.equal(parseOperativeTimes({ incisionAt: "2026-10-29T05:00:00Z" }, started, now).ok, false, "long before start");
});

test("supplies: consumables from stock, implants traced", () => {
  assert.equal(parseSupplies([{ kind: "consumable", itemId: U1, quantity: 2 }]).ok, true);
  assert.equal(parseSupplies([{ kind: "consumable", itemName: "Compresses", quantity: 2 }]).ok, false, "consumable outside stock");
  assert.equal(parseSupplies([{ kind: "implant", itemName: "Plaque vissée", quantity: 1 }]).ok, false, "implant without lot or serial");
  assert.equal(parseSupplies([{ kind: "implant", itemName: "Plaque vissée", quantity: 1, serialNumber: "SN-42" }]).ok, true);
  assert.equal(parseSupplies([{ kind: "consumable", itemId: U1, quantity: 0 }]).ok, false, "quantity");
});

test("start blockers: checklist always, consent and pre-anaesthesia unless emergency", () => {
  const phases = { signIn: true, timeOut: true };
  assert.deepEqual(startBlockers({ isEmergency: false, consentObtainedAt: null, preAnesthesiaAt: null }, phases), ["consent", "preAnesthesia"]);
  assert.deepEqual(startBlockers({ isEmergency: true, consentObtainedAt: null, preAnesthesiaAt: null }, phases), []);
  assert.deepEqual(startBlockers({ isEmergency: true, consentObtainedAt: null, preAnesthesiaAt: null }, { signIn: false, timeOut: true }), ["signIn"]);
});

test("overlap of two bookings uses their real lengths", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 29, h));
  assert.equal(overlaps(at(8), 240, at(10), 60), true, "a 4 h case at 8:00 blocks 10:00");
  assert.equal(overlaps(at(8), 60, at(10), 60), false);
  assert.equal(overlaps(at(8), 120, at(10), 60), false, "back to back is fine");
});
