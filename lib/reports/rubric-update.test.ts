import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRubricUpdate } from "@/lib/reports/rubric-update";

describe("parseRubricUpdate", () => {
  it("stores the ICD-10 list in canonical form", () => {
    assert.deepEqual(parseRubricUpdate({ icd10Ranges: " b50-b54 ,a39 " }), { ok: true, value: { icd10Ranges: "B50-B54, A39" } });
  });

  it("accepts each editable field, trimmed", () => {
    assert.deepEqual(parseRubricUpdate({ label: "  Paludisme ", isActive: false, order: 3 }), {
      ok: true,
      value: { label: "Paludisme", isActive: false, order: 3 },
    });
  });

  it("rejects invalid ranges and reports the faulty token", () => {
    assert.deepEqual(parseRubricUpdate({ icd10Ranges: "B54-B50" }), { ok: false, error: "invalid_ranges", token: "B54-B50" });
  });

  it("rejects invalid fields and empty updates", () => {
    assert.equal((parseRubricUpdate({ label: "  " }) as { error: string }).error, "invalid_label");
    assert.equal((parseRubricUpdate({ isActive: "yes" }) as { error: string }).error, "invalid_flag");
    assert.equal((parseRubricUpdate({ order: 1.5 }) as { error: string }).error, "invalid_order");
    assert.equal((parseRubricUpdate({ order: -1 }) as { error: string }).error, "invalid_order");
    assert.equal((parseRubricUpdate({}) as { error: string }).error, "empty_update");
    assert.equal((parseRubricUpdate(null) as { error: string }).error, "empty_update");
  });

  it("ignores fields that aren't editable (section, code)", () => {
    assert.deepEqual(parseRubricUpdate({ code: "RMA3-V.3-999", section: "V.9", order: 1 }), { ok: true, value: { order: 1 } });
  });
});
