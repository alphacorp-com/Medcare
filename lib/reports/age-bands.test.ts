import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ageInCompletedMonths, causeAgeBand } from "@/lib/reports/age-bands";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("ageInCompletedMonths", () => {
  it("counts completed calendar months", () => {
    assert.equal(ageInCompletedMonths(d("2026-01-15"), d("2026-02-14")), 0);
    assert.equal(ageInCompletedMonths(d("2026-01-15"), d("2026-02-15")), 1);
    assert.equal(ageInCompletedMonths(d("2021-10-21"), d("2026-10-21")), 60);
  });
  it("handles month ends (born on the 31st)", () => {
    assert.equal(ageInCompletedMonths(d("2026-01-31"), d("2026-02-28")), 1);
    assert.equal(ageInCompletedMonths(d("2026-01-31"), d("2026-02-27")), 0);
  });
  it("never goes negative", () => {
    assert.equal(ageInCompletedMonths(d("2026-10-21"), d("2026-10-01")), 0);
  });
});

describe("causeAgeBand", () => {
  it("splits at 5 and 15 years, at the date of the event", () => {
    assert.equal(causeAgeBand(d("2021-10-22"), d("2026-10-21")), "age0to59m"); // 59 months
    assert.equal(causeAgeBand(d("2021-10-21"), d("2026-10-21")), "age5to14"); // exactly 5 years
    assert.equal(causeAgeBand(d("2011-10-22"), d("2026-10-21")), "age5to14"); // 14 years 11 months
    assert.equal(causeAgeBand(d("2011-10-21"), d("2026-10-21")), "age15plus"); // exactly 15 years
  });
});
