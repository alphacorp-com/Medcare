# DHIS2 Monthly Aggregate Reporting

This document describes how Medcare pushes monthly aggregate activity indicators (admissions, deaths, surgeries, lab/radiology activity, pharmacy dispensing) to [DHIS2](https://dhis2.org), the health information system used by Cameroon's Ministry of Public Health (MINSANTE) for routine facility reporting.

## Overview

Medcare computes a fixed set of monthly indicators from its clinical data and submits them to DHIS2's Aggregate `dataValueSets` API for the tenant's configured organisation unit. This is **push-only** (Medcare → DHIS2) and **aggregate-only** — no individual patient records leave Medcare.

Each hospital configures its own connection from **Settings → External Integrations**: DHIS2 base URL, credentials, organisation unit, data set, and a mapping from Medcare's internal indicators to DHIS2 Data Element UIDs.

## Indicator Catalog

Computed in `lib/dhis2/indicators.ts` for a `[monthStart, monthEnd)` window:

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

Metrics with no configured Data Element mapping are skipped and reported back in the sync result, not sent as zero.

## Configuring a Hospital's Connection

1. Sign in as a `tenant_admin` and go to **Settings → External Integrations**.
2. Fill in:
   - **DHIS2 Base URL** — e.g. `https://dhis-minsante-cm.org`
   - **Username** / **Password** — a DHIS2 account with data-entry rights on the target data set and org unit
   - **Organisation Unit ID** — the DHIS2 UID for this facility
   - **Data Set ID** — the DHIS2 UID of the monthly reporting data set
3. Click **Test Connection** to confirm the credentials work before saving.
4. In the **Indicator Mapping** section, enter the DHIS2 Data Element UID (and optional Category Option Combo UID) for each Medcare metric you want to report. You can find these UIDs via the DHIS2 Maintenance app or `GET /api/dataElements`.
5. Check **Enable monthly sync to DHIS2** and **Save Connection**.
6. Use **Sync Now** to push the previous complete month immediately, without waiting for the scheduled run.

The password is encrypted at rest (AES-256-GCM, key derived from `NEXTAUTH_SECRET`) and is never sent back to the browser after saving.

## Testing Against the DHIS2 Demo Server

DHIS2 publishes free, public demo instances for development — useful for validating the mapping workflow before pointing at the real MINSANTE instance. These instances are ephemeral (reset nightly, and the hostname changes between releases), so:

1. Get the current instance URL from the [DHIS2 Instance Manager](https://im.dhis2.org/public/instances) (look for a "stable" play instance).
2. Log in there with `admin` / `district` to confirm it's live.
3. Use that URL as the **Base URL** in Medcare's DHIS2 settings, with the same credentials, and pick any existing org unit / data set from that demo database for `Organisation Unit ID` / `Data Set ID`.
4. Map 2-3 indicators to real Data Element UIDs from that data set and run **Sync Now**; confirm the values appear in the demo's Data Entry app for that org unit/period.

Swap in the real MINSANTE base URL, org unit, data set, and credentials once the hospital has been provisioned in the national DHIS2 instance.

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
| `lib/dhis2/client.ts` | DHIS2 HTTP client (`testConnection`, `submitDataValueSet`) |
| `lib/dhis2/indicators.ts` | Computes the monthly indicator values from clinical tables |
| `lib/dhis2/sync.ts` | Orchestrates a sync run and writes the `AuditLog` outcome |
| `app/api/v1/settings/dhis2/*` | Tenant-facing settings, test-connection, sync-now |
| `app/api/cron/sync-dhis2/route.ts` | Scheduled monthly push for all enabled tenants |
| `components/settings/dhis2-integration-settings.tsx` | Settings UI |

Every sync attempt (cron or manual) writes an `AuditLog` row with `action: "dhis2.sync"`, including the period, indicator count, DHIS2's import counts, and any conflicts — useful for confirming what was actually submitted for a given month.

## Troubleshooting

- **Test Connection fails**: check the base URL (no trailing path beyond the DHIS2 root) and that the account isn't locked/disabled in DHIS2.
- **Sync Now returns "No indicators are mapped"**: at least one metric needs a Data Element UID before a sync can submit anything.
- **DHIS2 reports conflicts**: usually means the org unit isn't assigned to that data set, the period type doesn't match (data set must be Monthly), or a Category Option Combo UID is required but wasn't set for that data element.
