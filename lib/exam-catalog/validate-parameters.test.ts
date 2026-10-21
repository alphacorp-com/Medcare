import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_PARAMETERS, validateExamParameters } from "@/lib/exam-catalog/validate-parameters";
import { LAB_PARAMETERS, RADIOLOGY_PARAMETERS } from "@/lib/exam-catalog/standard-parameters";

function errorOf(input: unknown) {
  const result = validateExamParameters(input);
  assert.equal(result.ok, false, "expected a validation error");
  return result.ok ? null : { code: result.code, index: result.index };
}

describe("validateExamParameters", () => {
  it("accepts every standard sheet shipped with the catalog unchanged", () => {
    for (const [code, sheet] of Object.entries({ ...LAB_PARAMETERS, ...RADIOLOGY_PARAMETERS })) {
      const result = validateExamParameters(sheet);
      assert.ok(result.ok, `standard sheet ${code} rejected: ${JSON.stringify(result)}`);
      if (result.ok) assert.deepEqual(result.value, sheet, `standard sheet ${code} not preserved`);
    }
  });

  it("normalizes: trims text, drops unknown keys and empty optional fields", () => {
    const result = validateExamParameters([
      { name: "  Glycémie ", unit: " mmol/L", referenceRange: "3,9 – 6,1", low: 3.9, high: 6.1, section: "", extra: "x" },
    ]);
    assert.ok(result.ok);
    if (result.ok) {
      assert.deepEqual(result.value, [{ name: "Glycémie", unit: "mmol/L", referenceRange: "3,9 – 6,1", low: 3.9, high: 6.1 }]);
    }
  });

  it("rejects non-lists, oversized sheets and non-object rows", () => {
    assert.deepEqual(errorOf({ name: "x" }), { code: "not_a_list", index: undefined });
    assert.equal(errorOf(Array.from({ length: MAX_PARAMETERS + 1 }, (_, i) => ({ name: `p${i}` })))?.code, "too_many");
    assert.deepEqual(errorOf([{ name: "ok" }, "nope"]), { code: "not_an_object", index: 1 });
  });

  it("requires a name and bounds text length", () => {
    assert.deepEqual(errorOf([{ name: "  " }]), { code: "name_required", index: 0 });
    assert.equal(errorOf([{ name: "x".repeat(121) }])?.code, "too_long");
  });

  it("rejects numbers that aren't finite numbers", () => {
    assert.equal(errorOf([{ name: "a", low: "4" }])?.code, "not_a_number");
    assert.equal(errorOf([{ name: "a", high: Number.NaN }])?.code, "not_a_number");
  });

  it("rejects contradictory intervals", () => {
    assert.equal(errorOf([{ name: "a", low: 10, high: 4 }])?.code, "low_above_high");
    assert.equal(errorOf([{ name: "a", low: 4, high: 10, criticalLow: 5 }])?.code, "critical_inconsistent");
    assert.equal(errorOf([{ name: "a", low: 4, high: 10, criticalHigh: 8 }])?.code, "critical_inconsistent");
    assert.equal(errorOf([{ name: "a", criticalLow: 9, criticalHigh: 2 }])?.code, "critical_inconsistent");
    assert.equal(errorOf([{ name: "a", bySex: { F: { referenceRange: "", low: 5, high: 1 } } }])?.code, "low_above_high");
  });

  it("validates qualitative answers", () => {
    assert.equal(errorOf([{ name: "a", options: ["+", "+"] }])?.code, "options_duplicate");
    assert.equal(errorOf([{ name: "a", options: ["", "x"] }])?.code, "options_invalid");
    assert.equal(errorOf([{ name: "a", options: ["Nég", "Pos"], normalOptions: ["Autre"] }])?.code, "flag_option_unknown");
    assert.equal(
      errorOf([{ name: "a", options: ["Nég", "Pos"], normalOptions: ["Pos"], criticalOptions: ["Pos"] }])?.code,
      "flag_option_conflict"
    );
    assert.equal(errorOf([{ name: "a", normalOptions: ["Nég"] }])?.code, "flag_option_unknown");
    assert.equal(errorOf([{ name: "a", options: ["Nég", "Pos"], low: 1 }])?.code, "numeric_and_options");
  });

  it("rejects duplicate names within a section, case-insensitively", () => {
    assert.deepEqual(errorOf([{ name: "Hb", section: "A" }, { name: "hb", section: "A" }]), { code: "duplicate_name", index: 1 });
    assert.ok(validateExamParameters([{ name: "Hb", section: "A" }, { name: "Hb", section: "B" }]).ok);
  });
});
