export const DHIS2_METRIC_KEYS = [
  "admissions_total",
  "admissions_emergency",
  "admissions_scheduled",
  "admissions_outpatient",
  "discharges_total",
  "deaths_total",
  "surgeries_completed",
  "lab_exams_completed",
  "radiology_exams_completed",
  "drugs_dispensed_count",
  "anc_first_visit",
  "anc_fourth_visit_plus",
  "deliveries_total",
  "deliveries_cesarean",
  "tetanus_doses_given",
  "malaria_prevention_doses_given",
  "hiv_tests_pregnancy_completed",
  "newborns_total",
] as const;

export type Dhis2MetricKey = (typeof DHIS2_METRIC_KEYS)[number];

export interface Dhis2Mapping {
  metricKey: Dhis2MetricKey;
  dataElementId: string;
  categoryOptionComboId?: string;
}

/** Shape stored in TenantSetting.value under key "dhis2". Password is stored encrypted. */
export interface Dhis2Config {
  baseUrl: string;
  username: string;
  encryptedPassword: string;
  orgUnitId: string;
  dataSetId: string;
  mappings: Dhis2Mapping[];
  enabled: boolean;
}

export interface Dhis2MetricValue {
  metricKey: Dhis2MetricKey;
  value: number;
}

export interface Dhis2ImportCount {
  imported: number;
  updated: number;
  ignored: number;
  deleted: number;
}

export interface Dhis2Conflict {
  object?: string;
  value?: string;
  errorCode?: string;
  property?: string;
}

export interface Dhis2SubmitResult {
  ok: boolean;
  status: number;
  importCount?: Dhis2ImportCount;
  conflicts?: Dhis2Conflict[];
  error?: string;
}

export interface Dhis2TestConnectionResult {
  ok: boolean;
  status: number;
  displayName?: string;
  error?: string;
}
