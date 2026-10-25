-- Removes the former SaaS billing of the decommissioned multi-facility console: plans,
-- subscriptions, SaaS invoices, one-time charges, plan modules and license keys. Since an
-- install is licensed by AlphaCorp's signed on-prem license (on_prem_licenses), no code
-- reads or writes these tables. Patient invoices (patient_invoices) are not affected.
--
-- Irreversible: back up (or branch on Neon) before deploying on a database whose tables may
-- hold rows. Qualified with their schema and guarded with IF EXISTS so the migration also
-- runs on installs where some of these objects were never created.

DROP TABLE IF EXISTS "public"."license_keys" CASCADE;
DROP TABLE IF EXISTS "public"."plan_modules" CASCADE;
DROP TABLE IF EXISTS "public"."one_time_charges" CASCADE;
DROP TABLE IF EXISTS "public"."invoices" CASCADE;
DROP TABLE IF EXISTS "public"."subscriptions" CASCADE;
DROP TABLE IF EXISTS "public"."plans" CASCADE;

DROP TYPE IF EXISTS "public"."LicenseKeyStatus";
DROP TYPE IF EXISTS "public"."OneTimeChargeStatus";
DROP TYPE IF EXISTS "public"."OneTimeChargeType";
DROP TYPE IF EXISTS "public"."InvoiceStatus";
DROP TYPE IF EXISTS "public"."BillingCycle";
DROP TYPE IF EXISTS "public"."SubscriptionStatus";
