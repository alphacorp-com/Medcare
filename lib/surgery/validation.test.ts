import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAsaScore, parseComplications, parseDate, parseOptionalText, parseRequiredText } from "./validation";

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
