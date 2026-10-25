import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMtnStatus, mapOrangeStatus } from "./status";

test("Orange: only SUCCESS settles, FAILED and EXPIRED fail", () => {
  assert.equal(mapOrangeStatus("SUCCESS"), "successful");
  assert.equal(mapOrangeStatus("FAILED"), "failed");
  assert.equal(mapOrangeStatus("EXPIRED"), "failed");
});

test("Orange: intermediate, unknown or forged values stay pending", () => {
  for (const value of ["INITIATED", "PENDING", "SUCCESSFULL", "success", "", null, undefined, 1, { status: "SUCCESS" }]) {
    assert.equal(mapOrangeStatus(value), "pending", String(value));
  }
});

test("MTN: SUCCESSFUL settles, FAILED fails, anything else stays pending", () => {
  assert.equal(mapMtnStatus("SUCCESSFUL"), "successful");
  assert.equal(mapMtnStatus("FAILED"), "failed");
  for (const value of ["PENDING", "SUCCESS", "successful", null, undefined]) {
    assert.equal(mapMtnStatus(value), "pending", String(value));
  }
});
