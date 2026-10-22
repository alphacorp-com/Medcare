import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONFIDENTIAL_RESULT, redactConfidentialExams } from "@/lib/hiv/confidential-results";

const exams = [
  { examCode: "HIV", results: [{ resultData: { parameters: [{ value: "Réactif" }] }, reportUrl: "x", isCritical: true }] },
  { examCode: "NFS", results: [{ resultData: { parameters: [{ value: "12" }] }, reportUrl: null, isCritical: false }] },
];

describe("redactConfidentialExams", () => {
  it("empties the results of confidential exams for someone not allowed", () => {
    const out = redactConfidentialExams(exams, { canSee: false, confidentialCodes: new Set(["HIV"]) });
    assert.deepEqual(out[0].results[0], { resultData: CONFIDENTIAL_RESULT, reportUrl: null, isCritical: false });
    assert.deepEqual(out[1], exams[1]);
  });

  it("leaves everything to the allowed staff", () => {
    assert.equal(redactConfidentialExams(exams, { canSee: true, confidentialCodes: new Set(["HIV"]) }), exams);
  });
});
