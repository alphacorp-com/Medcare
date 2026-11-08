import { test } from "node:test";
import assert from "node:assert/strict";
import { periodsToSend } from "./rma3-schedule";

const now = new Date("2026-10-29T03:00:00Z");
const at = (iso: string) => new Date(iso);
const ok = (iso: string) => ({ at: at(iso), ok: true });
const failed = (iso: string) => ({ at: at(iso), ok: false });

test("a validated month never sent is owed", () => {
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-05T10:00:00Z") }], new Map(), now), ["202609"]);
});

test("a month sent after its validation is not sent again", () => {
  const sent = new Map([["202609", ok("2026-10-06T03:00:00Z")]]);
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-05T10:00:00Z") }], sent, now), []);
});

test("a month reopened and validated again after its last send is sent again", () => {
  const sent = new Map([["202609", ok("2026-10-06T03:00:00Z")]]);
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-20T09:00:00Z") }], sent, now), ["202609"]);
});

test("months validated too long ago are left to a manual send", () => {
  assert.deepEqual(periodsToSend([{ period: "202606", validatedAt: at("2026-07-10T10:00:00Z") }], new Map(), now), []);
});

test("oldest month first, at most `max` per run", () => {
  const validated = ["202609", "202607", "202608"].map((period) => ({ period, validatedAt: at("2026-10-10T10:00:00Z") }));
  assert.deepEqual(periodsToSend(validated, new Map(), now, { max: 2 }), ["202607", "202608"]);
});

test("a failed send is retried at the next daily run", () => {
  const attempts = new Map([["202609", failed("2026-10-28T03:00:00Z")]]);
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-05T10:00:00Z") }], attempts, now), ["202609"]);
});

test("a failed send is not retried again within the retry delay", () => {
  const attempts = new Map([["202609", failed("2026-10-29T01:00:00Z")]]);
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-05T10:00:00Z") }], attempts, now), []);
});

test("a failed send before the last validation does not hide the reopened month", () => {
  const attempts = new Map([["202609", failed("2026-10-28T23:00:00Z")]]);
  assert.deepEqual(periodsToSend([{ period: "202609", validatedAt: at("2026-10-29T01:30:00Z") }], attempts, now), ["202609"]);
});
