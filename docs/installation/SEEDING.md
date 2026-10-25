# Seeding a MedCare database

How to fill a MedCare database with the reference settings and the demo data
(150 patients, every module, third-party payment), safely and repeatably.
For a production install, stop after `npm run seed-settings`: see the
[installation guide](README.md).

> **Never seed a database that holds real patient data.** The demo seed adds
> 150 fictitious patients, staff accounts with a known password, invoices,
> payments and claims to the facility. It is meant for development, testing,
> training and demos.

---

## 1. What the seed chain does

The chain is made of three scripts, run in this order.

| Order | Command | What it writes | Safe to re-run? |
|---|---|---|---|
| 1 | `npm run seed` | Module catalog (tenant-independent). | Yes: refreshes names and descriptions. |
| 2 | `npm run seed-settings` | Reference settings of the facility: admission, appointment, room and insurance types; vaccine antigens; medical acts and categories (with their RMA3 income rubric); exam catalog; storage locations; suppliers; ICD-10 codes; **fee schedule**. | Yes: upserts by code and never overwrites a value the facility changed (RMA3 rubric, act nomenclature rate). |
| 3 | `npm run seed-journeys` | Demo data, described below. | Yes: only the missing patients are created (keyed by their `PJ` IPP). |

`npm run seed-journeys` creates:

- **Staff and structure:** departments, beds, medications with stock lots, 8 demo staff accounts.
- **150 patients and their care:** the 36 care journeys (appointments, emergencies, hospitalisation, surgery, lab, imaging, maternity, malaria, TB, vaccination, pharmacy, billing); ICD-10 diagnoses.
- **Programmes:** EPI with the cold chain, HIV / PMTCT / hepatitis, family planning, nutrition, oxygen, blood bank, HR register, TB screening, chronic care, civil registration, pharmacovigilance.
- **RMA3:** RMA3-tagged stock articles, the RMA3 identification and the monthly form (previous month validated, current month draft).
- **Planning and messaging.**
- **Third-party payment:**
  - payers, conventions, free-care programmes;
  - family memberships (holder, spouse, children, a holder who is not a patient);
  - prior authorizations and an indigent enrolment;
  - covered invoices;
  - claims at every stage, with a reversed rejection, a settlement balance allocated later and partly refunded to the payer;
  - patient overpayments, some refunded and some left to handle.

The data is spread over **the current and the previous month**: the RMA3 is
reported for the month that just ended, and the registers open on the current
month.

---

## 2. Prerequisites

1. **Code.** Use an up-to-date `main`. Run `git status` and `git log -1` to
   check which version you are on.
2. **Dependencies.** Run `npm install`. This also runs `prisma generate`; run
   `npm run db:generate` yourself if the schema changed since.
3. **Target database.** `DATABASE_URL` in `.env` points to the database to
   seed. Check it before going further:
   ```bash
   npx prisma migrate status
   ```
   The output prints the host and database name, and the pending migrations.
4. **A facility.** The seed targets the one tenant of an on-prem install. If
   there is none yet, open the application and complete **/setup**, which
   creates the facility and its administrator. The scripts stop with an
   explicit message when no tenant exists.

---

## 3. Back up first

Pick one of the two methods below.

- **Neon (recommended):** in the Neon console, create a **branch** of the
  database (Branches → Create branch). It is instant, and you can restore the
  database from it or simply discard it.
- **Any PostgreSQL:** take a dump. With PostgreSQL 18 installed locally:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --file=before-seed.dump
  ```
  To restore it later, run:
  `pg_restore --clean --no-owner -d "$DATABASE_URL" before-seed.dump`.

---

## 4. Run the chain

```bash
# 1. Schema: apply the pending migrations (nothing happens if they are all applied)
npm run db:migrate:deploy

# 2. Module catalog
npm run seed

# 3. Reference settings of the facility
npm run seed-settings

# 4. Demo data
npm run seed-journeys
```

**How long it takes.** On a local database, the demo data takes about
2 minutes. On a remote database such as Neon, every query is a network round
trip: allow **15 to 40 minutes**, depending on latency. Keep the terminal open;
the script prints its progress every 10 patients, then one line per module.

**Expected end of the output:**
```
150 patients seeded across 36 distinct journey types.
Seeding programme and RMA3 module data for 150 new patients...
  ...
  Coverage: 4 payers, 3 free-care programmes, … memberships, … beneficiaries, … covered invoices, … overpayments, 3 claims.
Staff logins: … — password "Demo1234!".
```

---

## 5. Re-running and upgrading

- **Re-run on a fully seeded database:** the script prints
  `All 150 patient journeys already present — nothing to do.`
- **Run interrupted after the patients were created** (before any programme
  data): the next run prints
  `All patients present, programme data missing: resuming the programme phase...`
  and completes it. Once the programme data has started reaching the patients
  (ICD-10 diagnoses exist), the script no longer resumes, because a resume could
  duplicate data: restore the backup instead.
- **Database seeded by an older version (50 patients):** run the chain again.
  The 100 missing patients are created with their journeys and programme data.
  Stay numbers continue after the existing ones, and stock dated before the old
  receipts is topped up automatically.
- **Facility-level data** (payers, blood donors, HR register, cold chain, RMA3
  periods…) is created only when the facility has none yet, so a re-run never
  duplicates it.
- **To start the demo data over:** restore the backup from section 3. On a
  throwaway database, you can instead run `npm run db:reset-data`, which
  **erases every row of every table**, and then go through **/setup** and the
  chain again. Never run this command on a database you care about.

---

### Databases seeded before 2026-10-25: hospitalisations

Older versions of `seed-journeys` gave demo patients a bed directly, without going through
hospitalisation (no deposit, no hospitalisation status), so **Admissions → Discharges** stayed
empty. The seed now records them like the app does (`prisma/seed-hospitalization.ts`). To repair
a database seeded before, back it up, then:

```bash
npm run db:backfill-demo-hospitalizations             # dry run: lists what would change
npm run db:backfill-demo-hospitalizations -- --apply  # writes
```

Only demo stays (`STPJ…` numbers) are touched, and the script can be re-run safely:
- stays in progress with a bed are hospitalised (3-day deposit, paid unless the patient is a
  vital emergency);
- ended stays kept 12 hours or more are hospitalised, then discharged with the deposit
  regularised;
- shorter ones simply release the bed.

## 6. Check the result

In the application, log in with a demo account (see section 7) and open:

| Screen | What you should see |
|---|---|
| Patients | 150 `PJ…` patients (plus newborns). |
| Admissions / consultations / beds | Stays in progress, discharged, transferred, deceased. |
| Admissions → Discharges | Hospitalised patients (deposit paid, or due for vital emergencies) and past hospitalisations with their discharge record. |
| Disease programs | Vaccination, sessions, cold chain, AEFI, malaria, TB (cases and screening), nutrition, oxygen, chronic care, HIV. |
| Maternity | Pregnancies, deliveries, postnatal visits, family planning. |
| Pharmacy | Prescription queue, inventory with RMA3 articles, monthly stock report, pharmacovigilance. |
| Laboratory / blood bank | Exams at every status; donors, sessions, bags at every status. |
| Billing → Invoices | Invoices at every status. The **Overpaid** filter lists the overpayments still to refund. |
| Billing → Receivables and claims | Receivables per payer; CNPS claim partially settled; AXA claim closed; Mutual claim in draft. |
| Patient file → Third-party payment | Memberships, beneficiaries, authorizations, exemptions. |
| RMA3 entry / Settings → Reports | RMA3 identification filled; monthly form (previous month validated). Generating the RMA3 of the previous month fills about 35 of the 42 activity tables (the rest are rare events: maternal deaths from malaria, cancers…). |
| Settings → Payers and conventions / Free-care programmes | 4 payers and 3 programmes. |

You can also check from the command line (read-only):
```bash
npx prisma studio
```

---

## 7. Demo accounts — security

The seed creates these staff accounts, all with the password **`Demo1234!`**:

- `dr.mendo@hospital.test` and `dr.abena@hospital.test`: doctors;
- `nurse.kamga@hospital.test`: nurse;
- `pharmacy.tchinda@hospital.test`: pharmacist;
- `lab.ngo@hospital.test`: lab technician;
- `radio.foka@hospital.test`: radiologist;
- `billing.essomba@hospital.test`: billing;
- `data.bikoula@hospital.test`: RMA3 data manager.

**On any database reachable from outside**, such as a shared Neon instance or a
demo server, change these passwords or deactivate the accounts as soon as the
demo is over (Settings → Users). A known password is a way in.

The settings seed adds **demo prices** to the exams that have none (8 000 FCFA
for lab exams, 35 000 FCFA for imaging) and demo **nomenclature rates** to a
few acts. These are not official tariffs: replace them with the facility's own.

---

## 8. Troubleshooting

| Message | Cause | What to do |
|---|---|---|
| `P1001 Can't reach database server` (Neon) | The Neon compute is suspended and takes time to wake up. | Run `npx prisma migrate status` again after a few seconds. Check your network and VPN. |
| `No tenant found on this install — complete /setup first` | The database has no facility. | Complete **/setup** in the application, then run the chain again. |
| `P2028 … Transaction API error … timeout` | An interactive transaction outlived its time limit on a slow or remote database. | The application now allows 30 s (`lib/prisma.ts`, `transactionOptions`). Run `npm run seed-journeys` again: when every patient exists but the programme data never reached them, the script **resumes the programme phase** by itself. |
| `StockError: history_conflict` | A dated stock exit would come before the stock received. | This happens only with very old demo stock. The script tops it up automatically; run it again. If it persists, restore the backup and run the full chain. |
| `member_number_exists`, `already_beneficiary` | Coverage demo data was partly created by an interrupted run. | The coverage data is skipped as soon as a payer exists. Restore the backup, or delete the demo payers and memberships, then run again. |
| A script stops halfway | Network cut, timeout. | Run it again: the patients already created are skipped. Facility-level demo data is skipped once it exists, so an interrupted module may stay incomplete. In that case, restore the backup and run the full chain. |

---

## 9. Test on a throwaway local database first (optional)

With PostgreSQL installed locally, you can rehearse the whole chain without
touching any shared database:

```bash
# A cluster in a scratch folder, port 55432, local access only
initdb -D ./pgdata -U postgres -A trust -E UTF8
pg_ctl -D ./pgdata -o "-p 55432 -c listen_addresses=127.0.0.1" start
createdb -h 127.0.0.1 -p 55432 -U postgres medcare_seed

# Point the scripts at it for this shell only (.env is left untouched)
export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/medcare_seed"
npm run db:migrate:deploy
# Complete /setup with `npm run dev` on this database, or create the tenant and its admin by script
npm run seed && npm run seed-settings && npm run seed-journeys
```

To stop the cluster: `pg_ctl -D ./pgdata stop`. To start over:
`dropdb medcare_seed`.
