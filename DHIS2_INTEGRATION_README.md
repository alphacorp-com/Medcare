# DHIS2 Monthly Aggregate Reporting

This document describes how Medcare pushes monthly aggregate activity indicators (admissions, deaths, surgeries, lab/radiology activity, pharmacy dispensing) to [DHIS2](https://dhis2.org), the health information system used by Cameroon's Ministry of Public Health (MINSANTE) for routine facility reporting.

## Overview

Medcare computes a fixed set of monthly indicators from its clinical data and submits them to DHIS2's Aggregate `dataValueSets` API for the tenant's configured organisation unit. This is **push-only** (Medcare → DHIS2) and **aggregate-only** — no individual patient records leave Medcare.

Each hospital configures its own connection from **Settings → External Integrations**: DHIS2 base URL, credentials, organisation unit, data set, and a mapping from Medcare's internal indicators to DHIS2 Data Element UIDs.

## Indicator Catalog

Computed in `lib/dhis2/indicators.ts` for a `[monthStart, monthEnd)` window, **scoped to the calling tenant** — every query is filtered by `tenantId` (fixed after an early version aggregated across all tenants; see Changelog):

| Metric key | Source |
|---|---|
| `admissions_total` | `Stay` count by `admissionDate` |
| `admissions_emergency` | `Stay` where `type = emergency` |
| `admissions_scheduled` | `Stay` where `type = scheduled` |
| `admissions_outpatient` | `Stay` where `type = outpatient` |
| `discharges_total` | `Stay` count by `dischargeDate` |
| `deaths_total` | `Stay` where `status = deceased`, plus deceased patients with no linked stay |
| `surgeries_completed` | `SurgicalProcedure` where `status = completed`, by `endedAt` |
| `lab_exams_completed` | `ExamResult` for biology `ExamRequest`s, by `validatedAt` |
| `radiology_exams_completed` | `ExamResult` for radiology `ExamRequest`s, by `validatedAt` |
| `drugs_dispensed_count` | `DrugDispensing` where `status` in `(dispensed, administered)`, by `dispensedAt` |
| `anc_first_visit` | `AntenatalVisit` where `visitNumber = 1` (CPN1), by `visitDate` |
| `anc_fourth_visit_plus` | `AntenatalVisit` where `visitNumber >= 4` (CPN4+), by `visitDate` |
| `deliveries_total` | `Delivery` count by `deliveryDate` |
| `deliveries_cesarean` | `Delivery` where `mode = cesarean`, by `deliveryDate` |
| `tetanus_doses_given` | `AntenatalVisit` where `tetanusVaccineGiven = true` (VAT), by `visitDate` |
| `malaria_prevention_doses_given` | `AntenatalVisit` where `malariaPreventionGiven = true` (IPTp), by `visitDate` |
| `hiv_tests_pregnancy_completed` | `ExamResult` where the parent `ExamRequest` has `examCode = HIV` and a non-null `pregnancyId` (PMTCT screening), by `validatedAt` |
| `newborns_total` | `Newborn` count, via the linked `Delivery.deliveryDate` |

Metrics with no configured Data Element mapping are skipped and reported back in the sync result, not sent as zero.

## Configuring a Hospital's Connection

1. Sign in as a `tenant_admin` and go to **Settings → External Integrations**.
2. Fill in:
   - **DHIS2 Base URL** — e.g. `https://dhis-minsante-cm.org`
   - **Username** / **Password** — a DHIS2 account with data-entry rights on the target data set and org unit
   - **Organisation Unit ID** — search by facility name (see **Metadata Lookup** below) instead of pasting a raw UID
   - **Data Set ID** — search by name the same way
3. Click **Test Connection** to confirm the credentials work before saving.
4. **Save Connection** once (this persists the base URL/credentials) — the metadata search fields need a saved connection to query against.
5. In the **Indicator Mapping** section, use the search field to pick the DHIS2 Data Element for each Medcare metric you want to report (optionally add a Category Option Combo UID by hand — this one stays a plain text field, DHIS2's category-combo model is out of scope for the picker). The list is scoped to the Data Set you picked above.
6. Check **Enable monthly sync to DHIS2** and **Save Connection** again.
7. Use **Sync Now** to push the previous complete month immediately, without waiting for the scheduled run.

The password is encrypted at rest (AES-256-GCM, key derived from `NEXTAUTH_SECRET`) and is never sent back to the browser after saving.

## Metadata Lookup (Organisation Unit / Data Set / Data Element)

Instead of typing raw DHIS2 UIDs, the three fields above use a debounced name search (`components/settings/dhis2-entity-picker.tsx`) backed by `GET /api/v1/settings/dhis2/lookup?type=orgUnits|dataSets|dataElements&query=...&dataSetId=...`, which proxies DHIS2's own metadata API (`/api/organisationUnits`, `/api/dataSets`, `/api/dataElements` with `filter=name:ilike:...`) using the tenant's **already-saved** connection. This means:

- You must **Save Connection** at least once (with a valid base URL/username/password) before any search will return results — the lookup route has nothing to authenticate with otherwise, and returns a clear "save the connection settings first" error.
- The Data Element search is automatically scoped to the currently-selected Data Set (`filter=dataSetElements.dataSet.id:eq:{dataSetId}`), so change the Data Set first if you don't see the element you expect.
- If you already have a UID saved from before this feature existed, it's shown as a small "Current ID" hint under the search box until you search and pick a replacement — nothing is cleared automatically.

## Sync History & Retry

The **Sync History** section (bottom of the DHIS2 settings page) lists the last 24 sync attempts for the tenant — period, status (Success/Skipped/Failed), how many data values were sent, and the error or list of unmapped metrics for that attempt. It reads from `GET /api/v1/settings/dhis2/history`, which is just a query over the `AuditLog` rows every sync already writes (`action: "dhis2.sync"`) — no separate history table.

Failed or skipped rows get a **Retry** button, which re-runs `POST /api/v1/settings/dhis2/sync-now` for that exact period (not just "the previous month"). There's no separate retry queue or background worker: DHIS2's `dataValueSets` import is idempotent per `(dataElement, period, orgUnit)`, so re-submitting the same period is always safe, and a manual retry button is sufficient — no automatic retry scheduling exists, a human has to click it.

## Cron Job Setup

The monthly push runs via `GET /api/cron/sync-dhis2`, which loops over every tenant with DHIS2 sync enabled and submits the previous complete calendar month. It follows the exact same auth pattern as the existing subscription-check cron (see `SUBSCRIPTION_SYNC_README.md`):

- **Auth**: `Authorization: Bearer $CRON_SECRET` header. If `CRON_SECRET` is unset, the endpoint accepts unauthenticated requests — set it in production.
- **Schedule**: once a month is enough (e.g. `0 3 1 * *` — 03:00 on the 1st).

### Vercel Cron

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-dhis2",
      "schedule": "0 3 1 * *"
    }
  ]
}
```

### Manual trigger / smoke test

```bash
curl https://your-domain.com/api/cron/sync-dhis2 -H "Authorization: Bearer $CRON_SECRET"
```

## Implementation Reference

| File | Purpose |
|---|---|
| `lib/dhis2/types.ts` | Config shape, fixed metric catalog, shared types |
| `lib/dhis2/crypto.ts` | AES-256-GCM encrypt/decrypt for the stored password |
| `lib/dhis2/client.ts` | DHIS2 HTTP client (`testConnection`, `submitDataValueSet`, `searchOrgUnits`, `searchDataSets`, `searchDataElements`) |
| `lib/dhis2/indicators.ts` | Computes the monthly indicator values from clinical tables, tenant-scoped |
| `lib/dhis2/sync.ts` | Orchestrates a sync run and writes the `AuditLog` outcome |
| `app/api/v1/settings/dhis2/route.ts` | GET/PUT connection settings |
| `app/api/v1/settings/dhis2/test-connection/route.ts` | POST test connection (draft or saved credentials) |
| `app/api/v1/settings/dhis2/sync-now/route.ts` | POST trigger a sync for a given (or default) period |
| `app/api/v1/settings/dhis2/lookup/route.ts` | GET metadata search (org units / data sets / data elements) |
| `app/api/v1/settings/dhis2/history/route.ts` | GET last 24 sync attempts from `AuditLog` |
| `app/api/cron/sync-dhis2/route.ts` | Scheduled monthly push for all enabled tenants |
| `components/settings/dhis2-integration-settings.tsx` | Settings UI (connection, mapping, sync, history) |
| `components/settings/dhis2-entity-picker.tsx` | Debounced metadata search-and-select control |

Every sync attempt (cron, manual, or retry) writes an `AuditLog` row with `action: "dhis2.sync"`, including the period, indicator count, DHIS2's import counts, and any conflicts — this is both the audit trail and the data source for the Sync History table, so nothing needs to be queried twice.

## How to Test

Two things are required before *any* of this can be exercised end-to-end: a DHIS2 instance you can reach over HTTP(S), and an account on it with data-entry rights. Nothing in this integration is mockable locally — every button below makes a real outbound request to DHIS2.

### 1. Get a DHIS2 instance to point at

For development, use a public DHIS2 play instance rather than the real MINSANTE one:

1. Check the [DHIS2 Instance Manager](https://im.dhis2.org/public/instances) for the current "stable" play instance URL (these reset nightly and the hostname changes between releases).
2. Confirm it's up by logging in there directly with `admin` / `district`.

### 2. Configure the connection

1. Log into Medcare as a `tenant_admin`, go to **Settings → External Integrations**.
2. Enter the play instance's base URL and `admin` / `district`.
3. Click **Test Connection** — should report success with the DHIS2 display name. If this fails, nothing else downstream can work; fix the URL/credentials first.
4. Click **Save Connection**. This is required even if you already tested successfully — the metadata lookup below reads the *saved* config, not the form state.

### 3. Test the metadata lookup

1. In the **Organisation Unit ID** field, type part of a known org unit name from that instance (e.g. "Ngelehun" on the standard DHIS2 demo data). A dropdown should appear within ~300ms with matching org units; picking one fills the field with its UID.
2. Repeat for **Data Set ID** with a known data set name (e.g. "Reproductive Health" on the demo data).
3. In the **Indicator Mapping** section, pick a Data Element for 2-3 metrics — the dropdown should only show elements that belong to the Data Set chosen in step 2 (change the Data Set and re-search to confirm the filtering is live).
4. Type a nonsense query (e.g. "zzzzz") — should show "No results found" rather than an error.

### 4. Test a sync + history + retry

1. Check **Enable monthly sync to DHIS2**, **Save Connection**.
2. Click **Sync Now**. Expect a green success message with the number of values sent.
3. Scroll to **Sync History** — a new row should appear immediately (status Success, period, value count).
4. In DHIS2's own Data Entry app, open that org unit/period/data set and confirm the values landed.
5. To exercise the failure + retry path: remove all indicator mappings, **Save Connection**, click **Sync Now** again — expect a "No indicators are mapped" failure, and a new **Failed** row in history with a **Retry** button. Re-map at least one indicator, save, then click **Retry** on that failed row (not Sync Now) — confirm it re-submits for the *same* period shown on that row, and that the row's status flips to Success on the next history refresh.

Swap in the real MINSANTE base URL, org unit, data set, and credentials only once the hospital has been formally provisioned in the national DHIS2 instance — the play instance is for validating the workflow, not for real submissions.

## Troubleshooting

- **Test Connection fails**: check the base URL (no trailing path beyond the DHIS2 root) and that the account isn't locked/disabled in DHIS2.
- **Metadata search returns "save the connection settings first"**: the lookup route reads the saved config, not the form — click **Save Connection** before searching, even if Test Connection already succeeded.
- **Sync Now returns "No indicators are mapped"**: at least one metric needs a Data Element mapped before a sync can submit anything.
- **DHIS2 reports conflicts**: usually means the org unit isn't assigned to that data set, the period type doesn't match (data set must be Monthly), or a Category Option Combo UID is required but wasn't set for that data element.

## Changelog

- Fixed a tenant-isolation bug where `computeMonthlyIndicators` queried every table without a `tenantId` filter, meaning a multi-tenant deployment would report every hospital's combined activity to each hospital's DHIS2 org unit. All queries are now scoped by the calling tenant.
- Added 8 Maternity/PMTCT indicators (CPN1, CPN4+, deliveries, cesarean rate, VAT, IPTp, PMTCT HIV screening, newborns), enabled by the Maternity module.
- Added metadata search (org unit / data set / data element) instead of manual UID entry.
- Added Sync History with per-attempt Retry.
