import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMotherChildTables,
  gestationalWeeksAtBirth,
  postnatalContact,
  type McFpVisit,
  type McNewborn,
  type Rma3MotherChildInput,
} from "@/lib/reports/rma3-mother-child";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const start = d("2026-10-01");
const end = d("2026-11-01");
const woman25 = { birthDate: d("2001-05-01"), gender: "F" };
const girl17 = { birthDate: d("2009-05-01"), gender: "F" };
const man30 = { birthDate: d("1996-05-01"), gender: "M" };

const empty: Rma3MotherChildInput = {
  start,
  end,
  antenatalVisits: [],
  tdDoses: [],
  deliveries: [],
  pregnancyEnds: [],
  maternalDeaths: [],
  postnatalVisits: [],
  newborns: [],
  fpVisits: [],
};

const rowOf = (input: Partial<Rma3MotherChildInput>, code: string) =>
  buildMotherChildTables({ ...empty, ...input })
    .flatMap((t) => t.rows)
    .find((r) => r.code === code)!;

const newborn = (o: Partial<McNewborn> & Pick<McNewborn, "id">): McNewborn => ({
  sex: "F",
  outcome: "alive",
  deliveryDate: d("2026-10-10T08:00:00Z"),
  lastMenstrualPeriod: d("2026-01-01"), // 40 weeks on 10 Oct.
  birthWeightGrams: 3200,
  apgarScore5Min: 9,
  bagMaskVentilation: false,
  kangarooCare: false,
  incubatorCare: false,
  stillbirthType: null,
  breastfeedingStart: null,
  diedAt: null,
  deathCause: null,
  deathReviewedAt: null,
  ...o,
});

const fpVisit = (o: Partial<McFpVisit> & Pick<McFpVisit, "id">): McFpVisit => ({
  patientId: o.id,
  visitDate: d("2026-10-05"),
  clientStatus: "new_user",
  counseled: true,
  methodCode: "implant",
  isPostpartum: false,
  referredByChw: false,
  lastDeliveryDate: null,
  patient: woman25,
  ...o,
});

describe("helpers", () => {
  it("computes the gestational age at birth from the LMP", () => {
    assert.equal(gestationalWeeksAtBirth(d("2026-01-01"), d("2026-10-08")), 40);
    assert.equal(gestationalWeeksAtBirth(d("2026-03-01"), d("2026-10-08")), 31);
    assert.equal(gestationalWeeksAtBirth(null, d("2026-10-08")), null);
  });

  it("finds the post-natal contact of a visit", () => {
    const delivery = d("2026-10-01T10:00:00Z");
    assert.equal(postnatalContact(delivery, d("2026-10-03T09:00:00Z")), "h48");
    assert.equal(postnatalContact(delivery, d("2026-10-04T10:00:00Z")), null);
    assert.equal(postnatalContact(delivery, d("2026-10-08T10:00:00Z")), "d6to10");
    assert.equal(postnatalContact(delivery, d("2026-11-12T10:00:00Z")), "w6");
    assert.equal(postnatalContact(delivery, d("2026-11-25T10:00:00Z")), null);
  });
});

describe("antenatal complements", () => {
  it("counts outreach visits, haemoglobin and Td doses of pregnant women by rank", () => {
    const pregnant = [{ lastMenstrualPeriod: d("2026-05-01"), endedAt: d("2027-02-01") }];
    const input: Partial<Rma3MotherChildInput> = {
      antenatalVisits: [
        { patientId: "w1", visitDate: d("2026-10-03"), strategy: "outreach", hemoglobinMeasured: true, patient: woman25 },
        { patientId: "w2", visitDate: d("2026-10-04"), strategy: "fixed", hemoglobinMeasured: false, patient: girl17 },
      ],
      tdDoses: [
        { patientId: "w1", at: d("2026-10-03"), doseNumber: 2, fromAntenatalVisit: true, patient: woman25, pregnancies: [] },
        // Given in the vaccination register to a pregnant woman: counted.
        { patientId: "w2", at: d("2026-10-04"), doseNumber: 1, fromAntenatalVisit: false, patient: girl17, pregnancies: pregnant },
        // Not pregnant, not at an antenatal visit: not an antenatal Td.
        { patientId: "w3", at: d("2026-10-04"), doseNumber: 1, fromAntenatalVisit: false, patient: woman25, pregnancies: [] },
      ],
    };
    assert.equal(rowOf(input, "II.1.1-005").total, 1);
    assert.equal(rowOf(input, "II.1.1-020").total, 1);
    assert.deepEqual(rowOf(input, "II.1.1-010").cells, { age10to14: 0, age15to19: 1, age20plus: 0 });
    assert.equal(rowOf(input, "II.1.1-011").total, 1);
    assert.equal(rowOf(input, "II.1.1-014").total, 0);
  });
});

describe("deliveries, abortions and maternal deaths", () => {
  const input: Partial<Rma3MotherChildInput> = {
    deliveries: [
      { patientId: "w1", deliveryDate: d("2026-10-10"), amtsl: true, complications: ["eclampsia", "postpartum_hemorrhage"], complicationsManaged: true, breastfeedingStart: "within_30_min", patient: woman25 },
      { patientId: "w2", deliveryDate: d("2026-10-11"), amtsl: false, complications: ["uterine_rupture"], complicationsManaged: false, breastfeedingStart: "within_1_hour", patient: woman25 },
    ],
    pregnancyEnds: [
      { patientId: "w3", endedAt: d("2026-10-02"), abortionCare: "complicated", patient: woman25 },
      { patientId: "w4", endedAt: d("2026-10-02"), abortionCare: "uncomplicated", patient: woman25 },
      { patientId: "w5", endedAt: d("2026-09-02"), abortionCare: "complicated", patient: woman25 },
    ],
    maternalDeaths: [
      { patientId: "w6", at: d("2026-10-12"), cause: "hemorrhage", reviewedAt: d("2026-10-20"), patient: woman25 },
      { patientId: "w7", at: d("2026-09-12"), cause: "abortion", reviewedAt: d("2026-10-02"), patient: woman25 },
      { patientId: "w8", at: d("2026-10-15"), cause: "abortion", reviewedAt: null, patient: woman25 },
    ],
  };

  it("counts GATPA, the RMA3 complications and their management", () => {
    assert.equal(rowOf(input, "II.1.2-003").total, 1);
    assert.equal(rowOf(input, "II.1.2-007").total, 1);
    assert.equal(rowOf(input, "II.1.2-008").total, 1);
    assert.equal(rowOf(input, "II.1.2-009").total, 0);
    assert.equal(rowOf(input, "II.1.2-011").total, 1);
    assert.equal(rowOf(input, "II.1.2-025").total, 1);
  });

  it("counts post-abortion care in the month of the end of the pregnancy", () => {
    assert.equal(rowOf(input, "II.1.2-012").total, 1);
    assert.equal(rowOf(input, "II.1.2-013").total, 1);
    assert.equal(rowOf(input, "II.1.2-014").total, 1);
  });

  it("counts maternal deaths by cause in the month of death, reviews in the month of review", () => {
    assert.equal(rowOf(input, "II.1.2-019").total, 1);
    assert.equal(rowOf(input, "II.1.2-018").total, 1); // w8 only (w7 died in September)
    assert.equal(rowOf(input, "II.1.2-017").total, 2); // w6 and w7 reviewed in October
  });

  it("counts children put to the breast within the hour", () => {
    const rows = { newborns: [newborn({ id: "a", breastfeedingStart: "within_30_min" }), newborn({ id: "b", breastfeedingStart: "later" }), newborn({ id: "c", outcome: "stillbirth", stillbirthType: "fresh", breastfeedingStart: "within_1_hour" })] };
    assert.equal(rowOf(rows, "III.9-001").total, 1);
  });
});

describe("post-natal care", () => {
  it("classifies the contacts and counts the newborns examined", () => {
    const base = { patientId: "w1", deliveryDate: d("2026-10-01T10:00:00Z"), vitaminAGiven: false, ironFolateGiven: false, breastfeedingCounseling: false, newbornExamined: true, patient: woman25 };
    const input: Partial<Rma3MotherChildInput> = {
      postnatalVisits: [
        { ...base, visitDate: d("2026-10-02T10:00:00Z"), breastfeedingCounseling: true, newborns: [{ id: "n1", sex: "M" }, { id: "n2", sex: "F" }] },
        { ...base, visitDate: d("2026-10-08T10:00:00Z"), vitaminAGiven: true, newborns: [{ id: "n1", sex: "M" }] },
        { ...base, patientId: "w2", deliveryDate: d("2026-09-05T10:00:00Z"), visitDate: d("2026-10-17T10:00:00Z"), ironFolateGiven: true, newborns: [] },
      ],
    };
    assert.equal(rowOf(input, "II.1.3-006").total, 1);
    assert.equal(rowOf(input, "II.1.3-002").total, 1);
    assert.equal(rowOf(input, "II.1.3-003").total, 1);
    assert.equal(rowOf(input, "II.1.3-004").total, 1);
    assert.equal(rowOf(input, "II.1.3-005").total, 1);
    assert.deepEqual(rowOf(input, "II.1.4-003").cells, { M: 1, F: 1 });
    assert.deepEqual(rowOf(input, "II.1.4-004").cells, { M: 1, F: 0 });
  });
});

describe("newborns", () => {
  const input: Partial<Rma3MotherChildInput> = {
    newborns: [
      // 33 weeks, 1 900 g, kangaroo + incubator.
      newborn({ id: "p", lastMenstrualPeriod: d("2026-02-23"), birthWeightGrams: 1900, kangarooCare: true, incubatorCare: true, sex: "M" }),
      // At term, 2 300 g: low birth weight at term, asphyxia resuscitated with bag and mask.
      newborn({ id: "l", birthWeightGrams: 2300, apgarScore5Min: 5, bagMaskVentilation: true }),
      newborn({ id: "s1", outcome: "stillbirth", stillbirthType: "fresh" }),
      newborn({ id: "s2", outcome: "stillbirth", stillbirthType: "macerated" }),
      // Died at 10 h of asphyxia; died at day 5 of infection, reviewed; died at day 20.
      newborn({ id: "d1", diedAt: d("2026-10-10T18:00:00Z"), deathCause: "asphyxia" }),
      newborn({ id: "d2", diedAt: d("2026-10-15T08:00:00Z"), deathCause: "infection", deathReviewedAt: d("2026-10-25") }),
      newborn({ id: "d3", diedAt: d("2026-10-30T08:00:00Z"), deathCause: null }),
    ],
  };

  it("derives prematurity and low birth weight from the LMP and the weight", () => {
    assert.deepEqual(rowOf(input, "II.1.4-005").cells, { M: 1, F: 0 });
    assert.equal(rowOf(input, "II.1.4-006").total, 1);
    assert.equal(rowOf(input, "II.1.4-007").total, 1);
    assert.equal(rowOf(input, "II.1.4-008").total, 1);
    assert.equal(rowOf(input, "II.1.4-009").total, 1);
  });

  it("counts asphyxia, resuscitation and stillbirth types", () => {
    assert.equal(rowOf(input, "II.1.4-010").total, 1);
    assert.equal(rowOf(input, "II.1.4-011").total, 1);
    assert.equal(rowOf(input, "II.1.4-014").total, 1);
    assert.equal(rowOf(input, "II.1.4-015").total, 1);
  });

  it("counts neonatal deaths by age at death, cause and review", () => {
    assert.equal(rowOf(input, "II.1.4-016").total, 1);
    assert.equal(rowOf(input, "II.1.4-017").total, 2);
    assert.equal(rowOf(input, "II.1.4-018").total, 3);
    assert.equal(rowOf(input, "II.1.4-020").total, 1);
    assert.equal(rowOf(input, "II.1.4-021").total, 1);
    assert.equal(rowOf(input, "II.1.4-022").total, 0);
    assert.equal(rowOf(input, "II.1.4-023").total, 1);
  });
});

describe("family planning", () => {
  const input: Partial<Rma3MotherChildInput> = {
    fpVisits: [
      fpVisit({ id: "a", patient: girl17 }),
      // Same client back the same month: two visits, one person.
      fpVisit({ id: "a2", patientId: "a", patient: girl17, visitDate: d("2026-10-20"), clientStatus: "continuing_user", methodCode: null, counseled: false }),
      fpVisit({ id: "b", clientStatus: "continuing_user", methodCode: "coc", referredByChw: true }),
      fpVisit({ id: "c", patient: man30, methodCode: "vasectomy" }),
      // Post-partum, 30 h after the delivery: immediate.
      fpVisit({ id: "p", methodCode: "iud", isPostpartum: true, visitDate: d("2026-10-11T14:00:00Z"), lastDeliveryDate: d("2026-10-10T08:00:00Z") }),
      // Post-partum 3 weeks after: not immediate.
      fpVisit({ id: "q", methodCode: "pop", isPostpartum: true, visitDate: d("2026-10-25"), lastDeliveryDate: d("2026-10-04") }),
    ],
  };

  it("counts visits, counselled clients, new acceptors and CHW referrals by age and status", () => {
    assert.equal(rowOf(input, "II.1.5-001").total, 6);
    assert.equal(rowOf(input, "II.1.5-002").total, 5);
    assert.equal(rowOf(input, "II.1.5-003").total, 4);
    assert.equal(rowOf(input, "II.1.5-003").cells.age15to19_new_user, 1);
    assert.equal(rowOf(input, "II.1.5-004").cells.age25plus_continuing_user, 1);
  });

  it("counts users by method and post-partum method", () => {
    assert.equal(rowOf(input, "II.1.5-006/implant").total, 1);
    assert.equal(rowOf(input, "II.1.5-006/vasectomy").total, 1);
    assert.equal(rowOf(input, "II.1.5-007/iud").total, 1);
    assert.equal(rowOf(input, "II.1.5-007/pop").total, 1);
    assert.equal(rowOf(input, "II.1.2-027").total, 1);
  });
});
