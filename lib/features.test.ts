import { test } from "node:test";
import assert from "node:assert/strict";
import { readBooleanEnv } from "./features";

test("boolean environment switches", () => {
  for (const v of ["true", "TRUE", " 1 ", "yes", "on"]) assert.equal(readBooleanEnv(v, false), true, v);
  for (const v of ["false", "False", "0", "no", "off"]) assert.equal(readBooleanEnv(v, true), false, v);
  assert.equal(readBooleanEnv(undefined, true), true, "unset → default");
  assert.equal(readBooleanEnv("maybe", false), false, "unknown → default");
});
