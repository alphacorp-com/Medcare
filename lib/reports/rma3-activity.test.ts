import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityTables,
  isPregnantAt,
  type ActivityTable,
  type AntenatalVisitRow,
  type DeliveryRow,
  type Rma3ActivityInput,
  type StayRow,
  type TbCaseRow,
} from "@/lib/reports/rma3-activity";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const start = d("2026-10-01");
const end = d("2026-11-01");
const woman25 = { birthDate: d("2001-05-01"), gender: "F" };
const girl14 = { birthDate: d("2012-05-01"), gender: "F" };
const child3 = { birthDate: d("2023-05-01"), gender: "M" };
const man45 = { birthDate: d("1981-05-01"), gender: "M" };

const empty: Rma3ActivityInput = {
  start,
  end,
  asOf: end,
  antenatalVisits: [],
  deliveries: [],
  newborns: [],
  deceasedWomen: [],
  stays: [],
  deaths: [],
  surgeries: [],
  malariaCases: [],
  tbCases: [],
  tbHivOnArtPatientIds: new Set(),
  bloodPressures: [],
};

const visit = (o: Partial<AntenatalVisitRow> & Pick<AntenatalVisitRow, "visitNumber" | "visitDate">): AntenatalVisitRow => ({
  pregnancyId: "preg-1",
  patientId: "w1",
  gestationalAgeWeeks: 20,
  bloodPressureMeasured: false,
  ironFolateGiven: false,
  malariaPreventionGiven: false,
  patient: woman25,
  ...o,
});
const delivery = (o: Partial<DeliveryRow> = {}): DeliveryRow => ({
  patientId: "w1",
  deliveryDate: d("2026-10-10T08:00:00Z"),
  mode: "vaginal",
  complications: [],
  maternalOutcome: "alive",
  stayDischargeDate: null,
  hasStay: true,
  patient: woman25,
  ...o,
});
const stay = (o: Partial<StayRow> & Pick<StayRow, "id">): StayRow => ({
  patientId: o.id,
  admissionDate: d("2026-10-05"),
  consultationStatus: "completed",
  hospitalizedAt: null,
  dischargeDate: null,
  status: "in_progress",
  patient: man45,
  pregnancies: [],
  ...o,
});
const tbCase = (o: Partial<TbCaseRow> & Pick<TbCaseRow, "id">): TbCaseRow => ({
  patientId: o.id,
  notificationDate: d("2026-10-03"),
  caseType: "new_case",
  classification: "pulmonary_bacteriologically_confirmed",
  hivStatus: "unknown",
  treatmentStartDate: null,
  labFollowUpDates: [],
  patient: man45,
  ...o,
});

const table = (tables: ActivityTable[], section: string) => tables.find((t) => t.section === section)!;
const rowOf = (tables: ActivityTable[], code: string) => tables.flatMap((t) => t.rows).find((r) => r.code === code)!;

describe("buildActivityTables — antenatal care", () => {
  const tables = buildActivityTables({
    ...empty,
    antenatalVisits: [
      // Woman 1: CPN1 in August, CPN2 and CPN3 this month (iron at each visit → 3rd dose now).
      visit({ visitNumber: 1, visitDate: d("2026-08-10"), ironFolateGiven: true, malariaPreventionGiven: true }),
      visit({ visitNumber: 2, visitDate: d("2026-10-02"), ironFolateGiven: true, bloodPressureMeasured: true }),
      visit({ visitNumber: 3, visitDate: d("2026-10-25"), ironFolateGiven: true, malariaPreventionGiven: true }),
      // Girl of 14: CPN1 at 12 weeks this month.
      visit({ pregnancyId: "preg-2", patientId: "g1", patient: girl14, visitNumber: 1, visitDate: d("2026-10-07"), gestationalAgeWeeks: 12 }),
    ],
  });

  it("counts each woman once, in the band of her age at the visit", () => {
    assert.deepEqual(rowOf(tables, "II.1.1-002").cells, { age10to14: 1, age15to19: 0, age20plus: 1 });
    assert.equal(rowOf(tables, "II.1.1-002").total, 2);
    assert.equal(rowOf(tables, "II.1.1-001").total, 1);
  });

  it("splits the visits by rank and gestational age", () => {
    assert.equal(rowOf(tables, "II.1.1-003").total, 1);
    assert.equal(rowOf(tables, "II.1.1-004").total, 1);
    assert.equal(rowOf(tables, "II.1.1-006").total, 1);
    assert.equal(rowOf(tables, "II.1.1-007").total, 1);
    assert.equal(rowOf(tables, "II.1.1-008").total, 0);
    assert.equal(rowOf(tables, "II.1.1-015").total, 1);
  });

  it("counts the 3rd iron dose in the month it is given, using the earlier visits", () => {
    assert.equal(rowOf(tables, "II.1.1-024").total, 1);
  });

  it("ranks the IPT doses over the whole pregnancy", () => {
    // The October IPT is the 2nd of the pregnancy (the 1st was in August).
    assert.deepEqual(rowOf(tables, "IV.2.1-002").cells, { rank1: 0, rank2: 1, rank3: 0, rank4plus: 0 });
    assert.deepEqual(rowOf(tables, "IV.2.1-001").cells, { rank1: 1, rank2: 1, rank3: 1, rank4plus: 0 });
  });
});

describe("buildActivityTables — deliveries and newborns", () => {
  it("counts complications, caesareans, maternal deaths and 48 h stays", () => {
    const tables = buildActivityTables({
      ...empty,
      deliveries: [
        delivery({ complications: ["postpartum_hemorrhage"], stayDischargeDate: d("2026-10-13T08:00:00Z") }),
        delivery({ patientId: "w2", mode: "cesarean", complications: ["none"], stayDischargeDate: d("2026-10-11T08:00:00Z") }),
        delivery({ patientId: "w3", patient: girl14, maternalOutcome: "deceased", hasStay: false }),
      ],
      deceasedWomen: [
        // Died 30 days after a delivery: maternal death.
        { patientId: "w4", deceasedAt: d("2026-10-20"), patient: woman25, pregnancies: [{ lastMenstrualPeriod: d("2025-12-01"), endedAt: d("2026-09-20") }] },
        // Died 60 days after: not a maternal death.
        { patientId: "w5", deceasedAt: d("2026-10-20"), patient: woman25, pregnancies: [{ lastMenstrualPeriod: d("2025-11-01"), endedAt: d("2026-08-21") }] },
      ],
    });
    assert.equal(rowOf(tables, "II.1.2-001").total, 3);
    assert.deepEqual(rowOf(tables, "II.1.2-001").cells, { age10to14: 1, age15to19: 0, age20plus: 2 });
    assert.equal(rowOf(tables, "II.1.2-004").total, 1);
    assert.equal(rowOf(tables, "II.1.2-005").total, 1);
    assert.equal(rowOf(tables, "II.1.2-010").total, 1);
    assert.equal(rowOf(tables, "II.1.2-015").total, 2);
    // Only the first stayed 48 h (72 h); the second left after 24 h, the third had no stay.
    assert.equal(rowOf(tables, "II.1.3-001").total, 1);
  });

  it("separates live births (neonatal deaths included) and stillbirths, by sex", () => {
    const tables = buildActivityTables({
      ...empty,
      newborns: [
        { id: "n1", sex: "M", outcome: "alive", deliveryDate: d("2026-10-10") },
        { id: "n2", sex: "F", outcome: "neonatal_death", deliveryDate: d("2026-10-11") },
        { id: "n3", sex: "F", outcome: "stillbirth", deliveryDate: d("2026-10-12") },
        { id: "n4", sex: "U", outcome: "alive", deliveryDate: d("2026-10-12") },
      ],
    });
    assert.deepEqual(rowOf(tables, "II.1.4-001"), { code: "II.1.4-001", label: rowOf(tables, "II.1.4-001").label, cells: { M: 1, F: 1 }, total: 3 });
    assert.deepEqual(rowOf(tables, "II.1.4-013").cells, { M: 0, F: 1 });
  });
});

describe("buildActivityTables — general activity and malaria", () => {
  const pregnant = [{ lastMenstrualPeriod: d("2026-06-01"), endedAt: d("2027-03-01") }];
  const tables = buildActivityTables({
    ...empty,
    asOf: d("2026-11-01"),
    stays: [
      stay({ id: "s1", patient: child3 }),
      stay({ id: "s2", patient: woman25, pregnancies: pregnant }),
      stay({ id: "s3", consultationStatus: "waiting" }),
      // Hospitalized from 28 Sept. to 4 Oct.: 3 days in October.
      stay({ id: "s4", admissionDate: d("2026-09-28"), hospitalizedAt: d("2026-09-28"), dischargeDate: d("2026-10-04"), status: "transferred" }),
      // Hospitalized on 30 Oct., still in: 2 days.
      stay({ id: "s5", patientId: "s4", admissionDate: d("2026-10-30"), hospitalizedAt: d("2026-10-30") }),
    ],
    deaths: [{ id: "x1", patientId: "p9", diedAt: d("2026-10-15"), patient: man45, pregnancies: [] }],
    surgeries: [{ id: "op1", patientId: "p9", endedAt: d("2026-09-25"), patient: man45 }],
    malariaCases: [
      { id: "m1", patientId: "c1", diagnosedAt: d("2026-10-03"), testType: "rdt", result: "positive", severity: "simple", isPregnantAtDiagnosis: false, patient: child3 },
      { id: "m2", patientId: "w1", diagnosedAt: d("2026-10-04"), testType: "microscopy", result: "positive", severity: "severe", isPregnantAtDiagnosis: true, patient: woman25 },
      { id: "m3", patientId: "a1", diagnosedAt: d("2026-10-05"), testType: "clinical_only", result: "pending", severity: null, isPregnantAtDiagnosis: false, patient: man45 },
    ],
  });

  it("counts the consultations seen by a doctor, by age band", () => {
    assert.deepEqual(rowOf(tables, "V.1-001").cells, { age0to59m: 1, age5to14: 0, age15plus: 2 }); // s1, s2, s5 (s3 not seen yet)
  });

  it("counts persons hospitalized and hospital days within the month", () => {
    assert.equal(rowOf(tables, "V.1-003").total, 1); // s5 (s4 was hospitalized in September)
    assert.equal(rowOf(tables, "V.1-004").total, 5);
    assert.equal(rowOf(tables, "V.1-006").total, 1);
  });

  it("counts a death within 30 days of a surgery as peri-operative", () => {
    assert.equal(rowOf(tables, "V.1-008").total, 1);
    assert.equal(rowOf(tables, "V.1-010").total, 1);
    assert.equal(rowOf(tables, "V.1-007").total, 0); // the surgery ended in September
  });

  it("puts pregnant women in their own malaria column", () => {
    assert.deepEqual(rowOf(tables, "IV.2.4-5-001").cells, { under5_M: 1, under5_F: 0, over5_M: 1, over5_F: 0, pregnant: 1 });
    assert.equal(rowOf(tables, "IV.2.4-5-002").total, 3);
    assert.equal(rowOf(tables, "IV.2.4-5-003").total, 2);
    assert.equal(rowOf(tables, "IV.2.4-5-021").total, 2); // m1 (simple) and m3 (no severity)
    assert.equal(rowOf(tables, "IV.2.4-5-004").total, 1);
    assert.equal(rowOf(tables, "IV.2.4-5-035").total, 1);
    assert.equal(rowOf(tables, "IV.2.4-5-036").total, 0); // m2 is severe
  });
});

describe("buildActivityTables — tuberculosis and hypertension", () => {
  it("breaks TB rows down by age band and form", () => {
    const tables = buildActivityTables({
      ...empty,
      tbCases: [
        tbCase({ id: "t1", hivStatus: "positive", treatmentStartDate: d("2026-10-05"), labFollowUpDates: [d("2026-10-20"), d("2026-10-28")] }),
        tbCase({ id: "t2", caseType: "relapse", classification: "extrapulmonary", patient: child3, hivStatus: "negative" }),
        // Notified in September, followed up this month only.
        tbCase({ id: "t3", notificationDate: d("2026-09-01"), labFollowUpDates: [d("2026-10-02")] }),
      ],
      tbHivOnArtPatientIds: new Set(["t1"]),
    });
    const tb = table(tables, "IV.3");
    assert.equal(tb.columns.length, 9);
    assert.equal(rowOf(tables, "IV.3-006").cells.age15Plus_pulmonary_bacteriologically_confirmed, 1);
    assert.equal(rowOf(tables, "IV.3-007").cells.age0to4_extrapulmonary, 1);
    assert.equal(rowOf(tables, "IV.3-011").total, 2);
    assert.equal(rowOf(tables, "IV.3-012").total, 1);
    assert.equal(rowOf(tables, "IV.3-013").total, 1);
    assert.equal(rowOf(tables, "IV.3-016").total, 1);
    assert.equal(rowOf(tables, "IV.3-017").total, 2);
  });

  it("counts each person screened for hypertension once, by age and sex", () => {
    const tables = buildActivityTables({
      ...empty,
      bloodPressures: [
        { patientId: "a", recordedAt: d("2026-10-02"), patient: man45 },
        { patientId: "a", recordedAt: d("2026-10-09"), patient: man45 },
        { patientId: "b", recordedAt: d("2026-10-09"), patient: woman25 },
      ],
    });
    assert.deepEqual(rowOf(tables, "IV.4.4-001").cells, { under40_M: 0, under40_F: 1, age40plus_M: 1, age40plus_F: 0 });
  });
});

describe("isPregnantAt", () => {
  const periods = [{ lastMenstrualPeriod: d("2026-01-01"), endedAt: d("2026-09-15") }];
  it("is true between the LMP and the end of the pregnancy only", () => {
    assert.equal(isPregnantAt(periods, d("2026-05-01")), true);
    assert.equal(isPregnantAt(periods, d("2026-09-15")), false);
    assert.equal(isPregnantAt(periods, d("2025-12-31")), false);
  });
});
