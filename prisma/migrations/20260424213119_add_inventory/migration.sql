/*
  Warnings:

  - You are about to drop the `admin_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feature_flags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `modules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `one_time_charges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_modules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_feature_flags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_modules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenants` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."TenantStatus" AS ENUM ('trial', 'active', 'suspended', 'churned');

-- CreateEnum
CREATE TYPE "public"."TenantType" AS ENUM ('hospital', 'clinic', 'ehpad', 'lab', 'specialized');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."BillingCycle" AS ENUM ('monthly', 'annual', 'perpetual');

-- CreateEnum
CREATE TYPE "public"."PlanTier" AS ENUM ('core', 'clinical', 'advanced', 'enterprise');

-- CreateEnum
CREATE TYPE "public"."ModuleCategory" AS ENUM ('clinical', 'admin', 'finance', 'analytics', 'integration', 'hr');

-- CreateEnum
CREATE TYPE "public"."ModuleStatus" AS ENUM ('active', 'suspended', 'trial', 'pending');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "public"."OneTimeChargeType" AS ENUM ('implementation', 'training', 'integration', 'migration', 'custom', 'support');

-- CreateEnum
CREATE TYPE "public"."OneTimeChargeStatus" AS ENUM ('pending', 'invoiced', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('superadmin', 'sales', 'support', 'devops', 'finance');

-- CreateEnum
CREATE TYPE "public"."AuditActorType" AS ENUM ('admin', 'tenant_user', 'system', 'api');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "feature_flags" DROP CONSTRAINT "feature_flags_module_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "one_time_charges" DROP CONSTRAINT "one_time_charges_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "one_time_charges" DROP CONSTRAINT "one_time_charges_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "plan_modules" DROP CONSTRAINT "plan_modules_module_id_fkey";

-- DropForeignKey
ALTER TABLE "plan_modules" DROP CONSTRAINT "plan_modules_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_feature_flags" DROP CONSTRAINT "tenant_feature_flags_flag_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_feature_flags" DROP CONSTRAINT "tenant_feature_flags_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_modules" DROP CONSTRAINT "tenant_modules_module_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_modules" DROP CONSTRAINT "tenant_modules_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_settings" DROP CONSTRAINT "tenant_settings_tenant_id_fkey";

-- AlterTable
ALTER TABLE "adverse_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "billing_stays" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "drug_dispensings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam_results" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "medical_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prescriptions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "schedules" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stays" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "surgical_procedures" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_users" ALTER COLUMN "id" DROP DEFAULT;

-- DropTable
DROP TABLE "admin_users";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "feature_flags";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "modules";

-- DropTable
DROP TABLE "one_time_charges";

-- DropTable
DROP TABLE "plan_modules";

-- DropTable
DROP TABLE "plans";

-- DropTable
DROP TABLE "subscriptions";

-- DropTable
DROP TABLE "tenant_feature_flags";

-- DropTable
DROP TABLE "tenant_modules";

-- DropTable
DROP TABLE "tenant_settings";

-- DropTable
DROP TABLE "tenants";

-- DropEnum
DROP TYPE "AdminRole";

-- DropEnum
DROP TYPE "AuditActorType";

-- DropEnum
DROP TYPE "BillingCycle";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "ModuleCategory";

-- DropEnum
DROP TYPE "ModuleStatus";

-- DropEnum
DROP TYPE "OneTimeChargeStatus";

-- DropEnum
DROP TYPE "OneTimeChargeType";

-- DropEnum
DROP TYPE "PlanTier";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "TenantStatus";

-- DropEnum
DROP TYPE "TenantType";

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "public"."TenantType" NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'CM',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Africa/Douala',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "db_schema" VARCHAR(80) NOT NULL,
    "status" "public"."TenantStatus" NOT NULL DEFAULT 'trial',
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(30),
    "address" TEXT,
    "logo_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "suspended_at" TIMESTAMPTZ,
    "churned_at" TIMESTAMPTZ,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tier" "public"."PlanTier" NOT NULL,
    "billing_cycle" "public"."BillingCycle" NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price_per_bed" DECIMAL(8,2),
    "price_per_user" DECIMAL(8,2),
    "max_users" INTEGER,
    "max_beds" INTEGER,
    "max_storage_gb" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMPTZ,
    "current_period_start" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "seats_count" INTEGER NOT NULL DEFAULT 5,
    "beds_count" INTEGER NOT NULL DEFAULT 0,
    "mrr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "payment_method" VARCHAR(40),
    "external_sub_id" VARCHAR(120),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "amount_ht" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'draft',
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "invoice_pdf_url" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."one_time_charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "public"."OneTimeChargeType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "status" "public"."OneTimeChargeStatus" NOT NULL DEFAULT 'pending',
    "invoice_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."modules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "tier" "public"."PlanTier" NOT NULL,
    "category" "public"."ModuleCategory" NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "changelog" JSONB NOT NULL DEFAULT '[]',
    "price_monthly" DECIMAL(10,2),
    "price_annual" DECIMAL(10,2),
    "dependencies" JSONB NOT NULL DEFAULT '[]',
    "config_schema" JSONB NOT NULL DEFAULT '{}',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_beta" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_modules" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_included" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_modules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "status" "public"."ModuleStatus" NOT NULL DEFAULT 'pending',
    "activated_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "activated_by" UUID NOT NULL,
    "config_overrides" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "module_id" UUID,
    "description" TEXT,
    "default_value" BOOLEAN NOT NULL DEFAULT false,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_feature_flags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "value" BOOLEAN NOT NULL,
    "set_by" UUID NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "public"."AdminRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_id" UUID NOT NULL,
    "actor_type" "public"."AuditActorType" NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "resource_type" VARCHAR(80),
    "resource_id" UUID,
    "payload" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_inventory" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "manufacturer" VARCHAR(255),
    "category" VARCHAR(100),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "unit" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medication_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_db_schema_key" ON "public"."tenants"("db_schema");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "public"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "public"."tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_db_schema_idx" ON "public"."tenants"("db_schema");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key_key" ON "public"."tenant_settings"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "public"."subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "public"."subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "public"."invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "public"."invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "public"."invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "public"."modules"("code");

-- CreateIndex
CREATE INDEX "modules_code_idx" ON "public"."modules"("code");

-- CreateIndex
CREATE INDEX "modules_tier_idx" ON "public"."modules"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "plan_modules_plan_id_module_id_key" ON "public"."plan_modules"("plan_id", "module_id");

-- CreateIndex
CREATE INDEX "tenant_modules_tenant_id_idx" ON "public"."tenant_modules"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_modules_status_idx" ON "public"."tenant_modules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modules_tenant_id_module_id_key" ON "public"."tenant_modules"("tenant_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "public"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "public"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "tenant_feature_flags_tenant_id_idx" ON "public"."tenant_feature_flags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_id_flag_id_key" ON "public"."tenant_feature_flags"("tenant_id", "flag_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "public"."admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "public"."audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "public"."audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "public"."audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "public"."tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."one_time_charges" ADD CONSTRAINT "one_time_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."one_time_charges" ADD CONSTRAINT "one_time_charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_modules" ADD CONSTRAINT "plan_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_modules" ADD CONSTRAINT "tenant_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flags" ADD CONSTRAINT "feature_flags_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
