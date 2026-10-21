import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_DIAGNOSES, parseDiagnosisInput } from "@/lib/diagnoses/diagnosis-input";

const required = { principalRequired: true };
const optional = { principalRequired: false };
const err = (input: unknown, opts = required) => {
  const r = parseDiagnosisInput(input, opts);
  return r.ok ? null : r.error;
};

describe("parseDiagnosisInput", () => {
  it("normalizes codes and defaults isNewCase to true", () => {
    assert.deepEqual(parseDiagnosisInput([{ code: " b50.9 ", kind: "principal" }, { code: "D50", kind: "secondary", isNewCase: false }], required), {
      ok: true,
      value: [
        { code: "B50.9", kind: "principal", isNewCase: true },
        { code: "D50", kind: "secondary", isNewCase: false },
      ],
    });
  });

  it("requires a principal diagnosis when asked to", () => {
    assert.equal(err(undefined), "principal_required");
    assert.equal(err([]), "principal_required");
    assert.equal(err([{ code: "D50", kind: "secondary" }]), "principal_required");
  });

  it("accepts nothing when optional, but a non-empty list still needs its principal", () => {
    assert.deepEqual(parseDiagnosisInput(undefined, optional), { ok: true, value: [] });
    assert.deepEqual(parseDiagnosisInput([], optional), { ok: true, value: [] });
    assert.equal(err([{ code: "D50", kind: "secondary" }], optional), "principal_required");
  });

  it("allows a single principal and no duplicate codes", () => {
    assert.equal(err([{ code: "B50", kind: "principal" }, { code: "J18", kind: "principal" }]), "single_principal");
    assert.equal(err([{ code: "B50", kind: "principal" }, { code: "b50", kind: "secondary" }]), "duplicate_code");
  });

  it("rejects malformed input", () => {
    assert.equal(err("B50"), "not_a_list");
    assert.equal(err([null]), "invalid_entry");
    assert.equal(err([{ code: "paludisme", kind: "principal" }]), "invalid_code");
    assert.equal(err([{ code: "B50", kind: "main" }]), "invalid_entry");
    const many = Array.from({ length: MAX_DIAGNOSES + 1 }, (_, i) => ({ code: `A${String(i).padStart(2, "0")}`, kind: i ? "secondary" : "principal" }));
    assert.equal(err(many), "too_many");
  });
});
