import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHivReport, type EnrolmentRow, type PregnancyRow, type Rma3HivInput, type TestRow, type VisitRow } from "@/lib/hiv/rma3-hiv";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const start = d("2026-10-01");
const end = d("2026-11-01");
const adultF = { birthDate: d("1996-03-01"), gender: "F" };
const adultM = { birthDate: d("1990-03-01"), gender: "M" };

const test = (o: Partial<TestRow> & Pick<TestRow, "patientId">): TestRow => ({
  testType: "hiv",
  testedAt: d("2026-10-10"),
  result: "negative",
  entryPoint: "vct",
  isRetest: false,
  resultCollectedAt: null,
  pregnancyId: null,
  partnerOfPregnancyId: null,
  referralSource: "none",
  treatedAt: null,
  patient: adultF,
  ...o,
});
const visit = (date: string, next: string, o: Partial<VisitRow> = {}): VisitRow => ({
  visitDate: d(date),
  regimenCode: "TDF-3TC-DTG",
  regimenLine: 1,
  nextAppointmentDate: d(next),
  isEmergencySupply: false,
  tbScreened: false,
  tbSymptomsPositive: false,
  tbTested: false,
  tbConfirmed: false,
  tbTreatmentStarted: false,
  iptStarted: false,
  ...o,
});
const enrolment = (o: Partial<EnrolmentRow> & Pick<EnrolmentRow, "patientId">): EnrolmentRow => ({
  hivDiagnosisDate: null,
  artStartDate: d("2025-01-10"),
  enrolledAt: d("2025-01-10"),
  entryPoint: "vct",
  transferIn: null,
  pregnancyId: null,
  status: "active",
  statusChangedAt: null,
  transferOut: null,
  patient: adultM,
  visits: [],
  ...o,
});
const empty: Rma3HivInput = { start, end, tests: [], enrolments: [], pregnancies: [], infants: [], viralLoads: [], hepatitis: [], tbCases: [] };
const row = (rows: { code: string; total: number }[], code: string) => rows.find((r) => r.code === code)!.total;

describe("IV.1.1 HIV testing", () => {
  const report = buildHivReport({
    ...empty,
    tests: [
      test({ patientId: "A", result: "positive" }), // new positive
      test({ patientId: "B", result: "positive", testedAt: d("2026-10-12") }), // already known
      test({ patientId: "B", result: "positive", testedAt: d("2026-05-01") }),
      test({ patientId: "C", resultCollectedAt: d("2026-10-11") }),
      test({ patientId: "C", testedAt: d("2026-10-20") }), // same person twice
      test({ patientId: "D", result: "invalid" }),
    ],
    enrolments: [enrolment({ patientId: "A", artStartDate: d("2026-10-15"), enrolledAt: d("2026-10-15") })],
  });

  it("counts persons once, and new positives apart from the already known", () => {
    assert.equal(row(report.hivTesting, "IV.1.1-001"), 3); // A, B, C (D invalid)
    assert.equal(row(report.hivTesting, "IV.1.1-003"), 2);
    assert.equal(row(report.hivTesting, "IV.1.1-004"), 1);
    assert.equal(row(report.hivTesting, "IV.1.1-005"), 1);
    assert.equal(row(report.hivTesting, "IV.1.1-002"), 1);
  });

  it("counts samples, invalid ones included", () => {
    assert.equal(row(report.hivTesting, "IV.1.1-007"), 5);
    assert.equal(row(report.hivTesting, "IV.1.1-008"), 1);
  });
});

describe("IV.1.2 ART follow-up", () => {
  const report = buildHivReport({
    ...empty,
    enrolments: [
      // On time, came this month.
      enrolment({ patientId: "P1", visits: [visit("2026-09-10", "2026-10-10"), visit("2026-10-10", "2026-11-10")] }),
      // Next appointment Sept 20 → 41 days late at Oct 31: "non venu 1 mois".
      enrolment({ patientId: "P2", visits: [visit("2026-08-20", "2026-09-20")] }),
      // Due July 20 → 103 days late: lost to follow-up, out of the active file.
      enrolment({ patientId: "P3", visits: [visit("2026-06-20", "2026-07-20")] }),
      // New on ART this month, 2nd... no: switched from line 1 to 2 this month.
      enrolment({ patientId: "P4", visits: [visit("2026-09-05", "2026-10-05"), visit("2026-10-05", "2026-11-05", { regimenCode: "AZT-3TC-ATVr", regimenLine: 2, tbScreened: true })] }),
      // New this month.
      enrolment({ patientId: "P5", artStartDate: d("2026-10-03"), enrolledAt: d("2026-10-03"), visits: [visit("2026-10-03", "2026-11-03", { iptStarted: true, tbScreened: true })] }),
      // Died this month.
      enrolment({ patientId: "P6", status: "dead", statusChangedAt: d("2026-10-18"), visits: [visit("2026-10-01", "2026-11-01")] }),
      // Transferred in from abroad this month.
      enrolment({ patientId: "P7", transferIn: "abroad", artStartDate: d("2024-02-01"), enrolledAt: d("2026-10-07"), visits: [visit("2026-10-07", "2026-11-07")] }),
      // Back after 4 months away.
      enrolment({ patientId: "P8", visits: [visit("2026-05-01", "2026-06-01"), visit("2026-10-02", "2026-11-02")] }),
    ],
  });

  it("builds the active file from the days late at month end", () => {
    assert.equal(row(report.artFollowUp, "IV.1.2-003"), 6); // P1, P2, P4, P5, P7, P8
    assert.equal(row(report.artFollowUp, "IV.1.2-016"), 1); // P2
    assert.equal(row(report.artFollowUp, "IV.1.2-018"), 1); // P3
  });

  it("counts new, switched, died, transferred in and returned patients", () => {
    assert.equal(row(report.artFollowUp, "IV.1.2-002"), 1); // P5 (P7 is a transfer)
    assert.equal(row(report.artFollowUp, "IV.1.2-007"), 1); // P4
    assert.equal(row(report.artFollowUp, "IV.1.2-005"), 1); // P4 in 2nd line
    assert.equal(row(report.artFollowUp, "IV.1.2-015"), 1); // P6
    assert.equal(row(report.artFollowUp, "IV.1.2-020"), 1); // P7
    assert.equal(row(report.artFollowUp, "IV.1.2-023"), 1); // P8
    assert.equal(row(report.artFollowUp, "IV.1.2-009"), 1); // P5 IPT
    assert.equal(row(report.artFollowUp, "IV.1.2-010"), 2); // P4, P5 screened for TB
  });

  it("lists the active file per protocol", () => {
    const tld = report.artByRegimen.find((r) => r.code === "TDF-3TC-DTG");
    assert.equal(tld?.patients, 5);
  });
});

describe("PMTCT", () => {
  const pregnancy: PregnancyRow = {
    id: "G1",
    patientId: "W1",
    lastMenstrualPeriod: d("2026-06-01"),
    expectedDueDate: d("2027-03-08"),
    firstVisitDate: d("2026-10-05"),
    deliveryDate: null,
    hivKnownPositiveAtEntry: false,
    onArtAtEntry: false,
    hbvKnownPositiveAtEntry: false,
    referralSource: "asc",
    newbornsAlive: 0,
    patient: adultF,
  };
  const report = buildHivReport({
    ...empty,
    pregnancies: [pregnancy],
    tests: [
      test({ patientId: "W1", pregnancyId: "G1", entryPoint: "antenatal", testedAt: d("2026-10-05"), result: "positive" }),
      test({ patientId: "W1", pregnancyId: "G1", entryPoint: "antenatal", testType: "syphilis", testedAt: d("2026-10-05"), result: "positive", treatedAt: d("2026-10-06") }),
      test({ patientId: "M1", partnerOfPregnancyId: "G1", entryPoint: "antenatal", patient: adultM }),
    ],
    enrolments: [enrolment({ patientId: "W1", artStartDate: d("2026-10-06"), enrolledAt: d("2026-10-06"), entryPoint: "antenatal", patient: adultF })],
  });

  it("counts first antenatal tests, the partner, ART started during pregnancy and referrals", () => {
    assert.equal(row(report.pmtctAntenatal, "II.3.1-002"), 1);
    assert.equal(row(report.pmtctAntenatal, "II.3.1-004"), 1);
    assert.equal(row(report.pmtctAntenatal, "II.3.1-010"), 1);
    assert.equal(row(report.pmtctAntenatal, "II.3.1-012"), 1);
    assert.equal(row(report.pmtctAntenatal, "II.3.1-019"), 1); // HIV+ (same day) and syphilis+
    assert.equal(row(report.pmtctAntenatal, "II.3.1-022"), 1);
    assert.equal(row(report.pmtctReferrals, "II.3.3-001"), 1);
    assert.equal(row(report.pmtctReferrals, "II.3.3-003"), 1);
  });

  it("orders the infant PCRs and reads the age at the test", () => {
    const baby = { birthDate: d("2026-08-20"), gender: "M" };
    const r = buildHivReport({
      ...empty,
      infants: [{ patientId: "I1", bornInFacility: false, firstSeenAt: d("2026-08-22"), nevirapineStartedAt: null, cotrimoxazoleStartedAt: d("2026-10-02"), visit6to8WeeksAt: d("2026-10-02"), patient: baby }],
      tests: [test({ patientId: "I1", testType: "hiv_pcr", testedAt: d("2026-10-02"), entryPoint: "pediatric", patient: baby })], // 6 weeks
    });
    assert.equal(row(r.pmtctPostnatal, "II.3.5-004"), 1);
    assert.equal(row(r.pmtctPostnatal, "II.3.5-006"), 0);
    assert.equal(row(r.pmtctPostnatal, "II.3.5-003"), 1);
  });
});

describe("IV.1.3 hepatitis and STI", () => {
  const report = buildHivReport({
    ...empty,
    tests: [
      test({ patientId: "H1", testType: "hbsag", result: "positive" }),
      test({ patientId: "H1", testType: "hdv", result: "positive", testedAt: d("2026-10-15") }),
      test({ patientId: "H1", testType: "hiv", result: "negative", testedAt: d("2026-10-15") }),
      test({ patientId: "H2", testType: "hcv", result: "positive" }),
      test({ patientId: "H2", testType: "hbsag", result: "positive", testedAt: d("2025-01-01") }),
      test({ patientId: "S1", testType: "gonorrhea", result: "positive", patient: adultM }),
      test({ patientId: "S2", testType: "chlamydia" }),
    ],
    hepatitis: [
      { patientId: "H2", type: "hcv", diagnosedAt: d("2026-10-10"), deltaPositive: null, eligibleAt: d("2026-10-12"), treatmentStartedAt: d("2026-10-20"), treatmentStoppedAt: null, curedAt: null, cirrhosisAt: null, liverCancerAt: null, diedAt: null, patient: adultF },
    ],
  });

  it("counts screenings, positives, delta and co-infections", () => {
    assert.equal(row(report.hepatitisSti, "IV.1.3-002"), 1);
    assert.equal(row(report.hepatitisSti, "IV.1.3-004"), 2);
    assert.equal(row(report.hepatitisSti, "IV.1.3-008"), 1);
    assert.equal(row(report.hepatitisSti, "IV.1.3-013"), 1); // H1 tested for HIV
    assert.equal(row(report.hepatitisSti, "IV.1.3-017"), 1); // H2: HCV now, HBV before
    assert.equal(row(report.hepatitisSti, "IV.1.3-019"), 1);
    assert.equal(row(report.hepatitisSti, "IV.1.3-020"), 1);
  });

  it("counts STI carriers and each STI", () => {
    assert.equal(row(report.hepatitisSti, "IV.1.3-037"), 1);
    assert.equal(row(report.hepatitisSti, "IV.1.3-038"), 1);
    assert.equal(row(report.hepatitisSti, "IV.1.3-045"), 1);
  });
});
