import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PREGNANT,
  RMA3_AGE_SCHEMES,
  ageBand,
  ageInCompletedMonths,
  bandOrPregnant,
  causeAgeBand,
  disaggregationColumns,
  disaggregationKey,
  emptyCells,
  rma3Sex,
} from "@/lib/reports/age-bands";

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

describe("RMA3 age schemes", () => {
  it("open-ended schemes cover every age once, without gaps or overlaps", () => {
    for (const [name, bands] of Object.entries(RMA3_AGE_SCHEMES)) {
      for (let i = 1; i < bands.length; i++) {
        assert.equal(bands[i].fromMonths, bands[i - 1].toMonths, `${name}: ${bands[i].key} starts where ${bands[i - 1].key} ends`);
      }
      assert.equal(new Set(bands.map((b) => b.key)).size, bands.length, `${name}: unique keys`);
    }
  });

  it("puts children in the vaccination bands by calendar age (leap years included)", () => {
    const v = RMA3_AGE_SCHEMES.vaccination;
    // 365 days but only 11 completed months (2024 is a leap year): the old day count said 12-23.
    assert.equal(ageBand(v, d("2023-03-01"), d("2024-02-29")), "ageUnder12m");
    assert.equal(ageBand(v, d("2023-03-01"), d("2024-03-01")), "age12to23m");
    assert.equal(ageBand(v, d("2022-03-01"), d("2024-03-01")), "age24to59m");
    assert.equal(ageBand(v, d("2019-03-01"), d("2024-03-01")), "age5yPlus");
  });

  it("splits at the 5th birthday for malaria / asthma, not at 1826 days", () => {
    // 1826 days old yet 4 years 11 months (two leap days): the old threshold said 5+.
    assert.equal(ageBand(RMA3_AGE_SCHEMES.under5, d("2019-03-01"), d("2024-02-29")), "under5");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.under5, d("2019-03-01"), d("2024-03-01")), "over5");
  });

  it("counts a child exactly 5 years old as 5-14 for tuberculosis (no 365.25-day years)", () => {
    assert.equal(ageBand(RMA3_AGE_SCHEMES.tuberculosis, d("2021-01-01"), d("2026-01-01")), "age5to14");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.tuberculosis, d("2021-01-01"), d("2025-12-31")), "age0to4");
  });

  it("leaves patients outside a partial scheme out (mothers, adolescents)", () => {
    assert.equal(ageBand(RMA3_AGE_SCHEMES.mother, d("2017-01-01"), d("2026-10-21")), null); // 9 years
    assert.equal(ageBand(RMA3_AGE_SCHEMES.mother, d("2006-10-21"), d("2026-10-21")), "age20plus"); // 20 years
    assert.equal(ageBand(RMA3_AGE_SCHEMES.mother, d("2006-10-22"), d("2026-10-21")), "age15to19"); // 19 years
    assert.equal(ageBand(RMA3_AGE_SCHEMES.adolescent, d("2000-01-01"), d("2026-10-21")), null); // 26 years
  });

  it("applies the remaining dictionary boundaries", () => {
    const at = d("2026-10-21");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.ptme, d("2011-10-22"), at), "under15");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.ptme, d("2001-10-21"), at), "age25plus");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.mentalHealth, d("2015-10-22"), at), "age0to10"); // 10 years 11 months
    assert.equal(ageBand(RMA3_AGE_SCHEMES.mentalHealth, d("1970-10-22"), at), "age21to55"); // 55 years
    assert.equal(ageBand(RMA3_AGE_SCHEMES.eyeOral, d("1976-10-21"), at), "age50plus");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.diabetes, d("2005-10-21"), at), "age21plus");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.hypertension, d("1986-10-22"), at), "under40");
    assert.equal(ageBand(RMA3_AGE_SCHEMES.nutrition, d("2026-04-22"), at), "under6m"); // 5 months
    assert.equal(ageBand(RMA3_AGE_SCHEMES.nutrition, d("2021-10-21"), at), "age60mPlus");
  });
});

describe("sex, pregnancy and columns", () => {
  const adult = { birthDate: d("1990-01-01"), gender: "F" };
  const at = d("2026-10-21");

  it("maps Patient.gender to the RMA3 sex columns", () => {
    assert.equal(rma3Sex("M"), "M");
    assert.equal(rma3Sex("F"), "F");
    assert.equal(rma3Sex("U"), null);
    assert.equal(rma3Sex(null), null);
  });

  it("reports pregnant women in their own column", () => {
    assert.equal(bandOrPregnant("over5", true), PREGNANT);
    assert.equal(bandOrPregnant("over5", false), "over5");
  });

  it("builds band × sex keys, total-only for unknown sex, null outside the bands", () => {
    const bySexAndAge = { bands: RMA3_AGE_SCHEMES.hypertension, bySex: true };
    assert.deepEqual(disaggregationColumns(bySexAndAge).map((c) => c.key), ["under40_M", "under40_F", "age40plus_M", "age40plus_F"]);
    assert.equal(disaggregationKey(bySexAndAge, adult, at), "under40_F");
    assert.equal(disaggregationKey(bySexAndAge, { ...adult, gender: "U" }, at), "");
    assert.equal(disaggregationKey({ bands: RMA3_AGE_SCHEMES.adolescent, bySex: true }, adult, at), null);
    assert.equal(disaggregationKey({ bands: null, bySex: true }, adult, at), "F");
    assert.equal(disaggregationKey({ bands: null, bySex: false }, adult, at), "");
    assert.deepEqual(emptyCells(disaggregationColumns({ bands: null, bySex: true })), { M: 0, F: 0 });
  });
});
