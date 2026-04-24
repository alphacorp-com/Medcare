CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant_template";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'suspended', 'churned');

-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('hospital', 'clinic', 'ehpad', 'lab', 'specialized');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual', 'perpetual');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('core', 'clinical', 'advanced', 'enterprise');

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('clinical', 'admin', 'finance', 'analytics', 'integration', 'hr');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('active', 'suspended', 'trial', 'pending');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "OneTimeChargeType" AS ENUM ('implementation', 'training', 'integration', 'migration', 'custom', 'support');

-- CreateEnum
CREATE TYPE "OneTimeChargeStatus" AS ENUM ('pending', 'invoiced', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('superadmin', 'sales', 'support', 'devops', 'finance');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('admin', 'tenant_user', 'system', 'api');

-- CreateEnum
CREATE TYPE "tenant_template"."Gender" AS ENUM ('M', 'F', 'U');

-- CreateEnum
CREATE TYPE "tenant_template"."StayType" AS ENUM ('emergency', 'scheduled', 'day_care', 'outpatient');

-- CreateEnum
CREATE TYPE "tenant_template"."StayStatus" AS ENUM ('pre_admission', 'in_progress', 'discharged', 'transferred', 'deceased');

-- CreateEnum
CREATE TYPE "tenant_template"."MedicalRecordType" AS ENUM ('consultation', 'observation', 'surgery_report', 'discharge_letter', 'referral', 'nursing_note', 'anesthesia');

-- CreateEnum
CREATE TYPE "tenant_template"."PrescriptionStatus" AS ENUM ('pending', 'validated', 'dispensed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "tenant_template"."ExamType" AS ENUM ('biology', 'radiology', 'pathology', 'cardiology', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."ExamUrgency" AS ENUM ('stat', 'urgent', 'routine');

-- CreateEnum
CREATE TYPE "tenant_template"."ExamRequestStatus" AS ENUM ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "tenant_template"."SurgicalStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "tenant_template"."DispensingStatus" AS ENUM ('dispensed', 'administered', 'refused', 'wasted');

-- CreateEnum
CREATE TYPE "tenant_template"."ShiftType" AS ENUM ('morning', 'afternoon', 'night', 'on_call', 'off');

-- CreateEnum
CREATE TYPE "tenant_template"."ScheduleStatus" AS ENUM ('planned', 'confirmed', 'modified', 'absent', 'replaced');

-- CreateEnum
CREATE TYPE "tenant_template"."BillingStayStatus" AS ENUM ('open', 'coded', 'validated', 'billed', 'paid', 'contested');

-- CreateEnum
CREATE TYPE "tenant_template"."AdverseEventType" AS ENUM ('medication_error', 'fall', 'infection', 'procedure_complication', 'equipment_failure', 'diagnostic_error', 'other');

-- CreateEnum
CREATE TYPE "tenant_template"."AdverseEventSeverity" AS ENUM ('minor', 'moderate', 'major', 'catastrophic');

-- CreateEnum
CREATE TYPE "tenant_template"."AdverseEventStatus" AS ENUM ('reported', 'under_analysis', 'action_plan', 'closed');

-- CreateEnum
CREATE TYPE "tenant_template"."TenantUserRole" AS ENUM ('tenant_admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiologist', 'billing', 'hr', 'viewer');

-- CreateEnum
CREATE TYPE "tenant_template"."DepartmentType" AS ENUM ('emergency', 'surgery', 'icu', 'medicine', 'pediatrics', 'radiology', 'laboratory', 'pharmacy', 'admin', 'other');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "TenantType" NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'CM',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Africa/Douala',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "db_schema" VARCHAR(80) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
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
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
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
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
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
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "amount_ht" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "invoice_pdf_url" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_charges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "type" "OneTimeChargeType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'XAF',
    "status" "OneTimeChargeStatus" NOT NULL DEFAULT 'pending',
    "invoice_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "category" "ModuleCategory" NOT NULL,
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
CREATE TABLE "plan_modules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "plan_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_included" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'pending',
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
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
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
CREATE TABLE "tenant_feature_flags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
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
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "AdminRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "actor_id" UUID NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
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
CREATE TABLE "tenant_template"."patients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipp" VARCHAR(20) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "maiden_name" VARCHAR(120),
    "birth_date" DATE NOT NULL,
    "birth_place" VARCHAR(120),
    "gender" "tenant_template"."Gender" NOT NULL,
    "nationality" CHAR(2) NOT NULL DEFAULT 'CM',
    "marital_status" VARCHAR(20),
    "blood_group" VARCHAR(5),
    "nss" VARCHAR(30),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "address" TEXT,
    "emergency_contact" JSONB NOT NULL DEFAULT '{}',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "chronic_conditions" JSONB NOT NULL DEFAULT '[]',
    "gdpr_consent" BOOLEAN NOT NULL DEFAULT false,
    "gdpr_consent_at" TIMESTAMPTZ,
    "is_deceased" BOOLEAN NOT NULL DEFAULT false,
    "deceased_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."stays" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "patient_id" UUID NOT NULL,
    "stay_number" VARCHAR(20) NOT NULL,
    "type" "tenant_template"."StayType" NOT NULL,
    "status" "tenant_template"."StayStatus" NOT NULL DEFAULT 'in_progress',
    "admission_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharge_date" TIMESTAMPTZ,
    "department_id" UUID,
    "bed_id" UUID,
    "attending_doctor_id" UUID,
    "admission_reason" TEXT,
    "discharge_summary" TEXT,
    "pmsi_code" VARCHAR(20),
    "pmsi_validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."medical_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "author_id" UUID NOT NULL,
    "type" "tenant_template"."MedicalRecordType" NOT NULL,
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "content_html" TEXT,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMPTZ,
    "signed_by" UUID,
    "signature_hash" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."prescriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "prescriber_id" UUID NOT NULL,
    "status" "tenant_template"."PrescriptionStatus" NOT NULL DEFAULT 'pending',
    "prescribed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ,
    "items" JSONB NOT NULL DEFAULT '[]',
    "contraindication_check" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."exam_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "prescriber_id" UUID NOT NULL,
    "type" "tenant_template"."ExamType" NOT NULL,
    "exam_code" VARCHAR(60) NOT NULL,
    "exam_label" VARCHAR(255) NOT NULL,
    "urgency" "tenant_template"."ExamUrgency" NOT NULL DEFAULT 'routine',
    "status" "tenant_template"."ExamRequestStatus" NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."exam_results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "request_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "performer_id" UUID NOT NULL,
    "result_data" JSONB NOT NULL DEFAULT '{}',
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "critical_notified_at" TIMESTAMPTZ,
    "validated_at" TIMESTAMPTZ,
    "validated_by" UUID,
    "report_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."surgical_procedures" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "patient_id" UUID NOT NULL,
    "stay_id" UUID,
    "surgeon_id" UUID NOT NULL,
    "anesthesiologist_id" UUID,
    "room_id" UUID,
    "procedure_code" VARCHAR(30),
    "procedure_label" VARCHAR(255) NOT NULL,
    "scheduled_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "status" "tenant_template"."SurgicalStatus" NOT NULL DEFAULT 'scheduled',
    "asa_score" SMALLINT,
    "who_checklist" JSONB NOT NULL DEFAULT '{}',
    "surgical_report" TEXT,
    "anesthesia_report" TEXT,
    "complications" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "surgical_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."drug_dispensings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "prescription_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pharmacist_id" UUID NOT NULL,
    "nurse_id" UUID,
    "drug_code" VARCHAR(60) NOT NULL,
    "drug_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(20),
    "lot_number" VARCHAR(60),
    "expiry_date" DATE,
    "dispensed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administered_at" TIMESTAMPTZ,
    "barcode_scan" VARCHAR(120),
    "status" "tenant_template"."DispensingStatus" NOT NULL DEFAULT 'dispensed',
    "notes" TEXT,

    CONSTRAINT "drug_dispensings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."departments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "tenant_template"."DepartmentType",
    "head_id" UUID,
    "phone" VARCHAR(30),
    "location" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."tenant_users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "tenant_template"."TenantUserRole" NOT NULL,
    "specialty" VARCHAR(120),
    "rpps_number" VARCHAR(20),
    "department_id" UUID,
    "phone" VARCHAR(30),
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "shift_type" "tenant_template"."ShiftType" NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "status" "tenant_template"."ScheduleStatus" NOT NULL DEFAULT 'planned',
    "replaced_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."billing_stays" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "stay_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "tenant_template"."BillingStayStatus" NOT NULL DEFAULT 'open',
    "pmsi_code" VARCHAR(20),
    "pmsi_validated_by" UUID,
    "pmsi_validated_at" TIMESTAMPTZ,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "insurance_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "patient_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "sesam_reference" VARCHAR(80),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."adverse_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "declared_by" UUID NOT NULL,
    "patient_id" UUID,
    "stay_id" UUID,
    "type" "tenant_template"."AdverseEventType" NOT NULL,
    "severity" "tenant_template"."AdverseEventSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "immediate_action" TEXT,
    "status" "tenant_template"."AdverseEventStatus" NOT NULL DEFAULT 'reported',
    "rca_analysis" JSONB NOT NULL DEFAULT '{}',
    "action_plan" JSONB NOT NULL DEFAULT '[]',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "adverse_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_db_schema_key" ON "tenants"("db_schema");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_db_schema_idx" ON "tenants"("db_schema");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key_key" ON "tenant_settings"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE INDEX "modules_code_idx" ON "modules"("code");

-- CreateIndex
CREATE INDEX "modules_tier_idx" ON "modules"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "plan_modules_plan_id_module_id_key" ON "plan_modules"("plan_id", "module_id");

-- CreateIndex
CREATE INDEX "tenant_modules_tenant_id_idx" ON "tenant_modules"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_modules_status_idx" ON "tenant_modules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modules_tenant_id_module_id_key" ON "tenant_modules"("tenant_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "tenant_feature_flags_tenant_id_idx" ON "tenant_feature_flags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_id_flag_id_key" ON "tenant_feature_flags"("tenant_id", "flag_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_ipp_key" ON "tenant_template"."patients"("ipp");

-- CreateIndex
CREATE UNIQUE INDEX "patients_nss_key" ON "tenant_template"."patients"("nss");

-- CreateIndex
CREATE INDEX "patients_ipp_idx" ON "tenant_template"."patients"("ipp");

-- CreateIndex
CREATE INDEX "patients_birth_date_idx" ON "tenant_template"."patients"("birth_date");

-- CreateIndex
CREATE UNIQUE INDEX "stays_stay_number_key" ON "tenant_template"."stays"("stay_number");

-- CreateIndex
CREATE INDEX "stays_patient_id_idx" ON "tenant_template"."stays"("patient_id");

-- CreateIndex
CREATE INDEX "stays_status_idx" ON "tenant_template"."stays"("status");

-- CreateIndex
CREATE INDEX "stays_admission_date_idx" ON "tenant_template"."stays"("admission_date" DESC);

-- CreateIndex
CREATE INDEX "prescriptions_patient_id_idx" ON "tenant_template"."prescriptions"("patient_id");

-- CreateIndex
CREATE INDEX "prescriptions_status_idx" ON "tenant_template"."prescriptions"("status");

-- CreateIndex
CREATE INDEX "exam_requests_patient_id_idx" ON "tenant_template"."exam_requests"("patient_id");

-- CreateIndex
CREATE INDEX "exam_requests_status_idx" ON "tenant_template"."exam_requests"("status");

-- CreateIndex
CREATE INDEX "exam_results_is_critical_idx" ON "tenant_template"."exam_results"("is_critical");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "tenant_template"."departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_key" ON "tenant_template"."tenant_users"("email");

-- CreateIndex
CREATE INDEX "schedules_user_id_date_idx" ON "tenant_template"."schedules"("user_id", "date");

-- CreateIndex
CREATE INDEX "schedules_department_id_date_idx" ON "tenant_template"."schedules"("department_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_user_id_date_shift_type_key" ON "tenant_template"."schedules"("user_id", "date", "shift_type");

-- CreateIndex
CREATE UNIQUE INDEX "billing_stays_stay_id_key" ON "tenant_template"."billing_stays"("stay_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_charges" ADD CONSTRAINT "one_time_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_charges" ADD CONSTRAINT "one_time_charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."stays" ADD CONSTRAINT "stays_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."medical_records" ADD CONSTRAINT "medical_records_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."prescriptions" ADD CONSTRAINT "prescriptions_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."exam_requests" ADD CONSTRAINT "exam_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."exam_requests" ADD CONSTRAINT "exam_requests_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."exam_results" ADD CONSTRAINT "exam_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "tenant_template"."exam_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."exam_results" ADD CONSTRAINT "exam_results_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."surgical_procedures" ADD CONSTRAINT "surgical_procedures_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."surgical_procedures" ADD CONSTRAINT "surgical_procedures_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."drug_dispensings" ADD CONSTRAINT "drug_dispensings_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "tenant_template"."prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."drug_dispensings" ADD CONSTRAINT "drug_dispensings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."tenant_users" ADD CONSTRAINT "tenant_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "tenant_template"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."schedules" ADD CONSTRAINT "schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_template"."tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."schedules" ADD CONSTRAINT "schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "tenant_template"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."billing_stays" ADD CONSTRAINT "billing_stays_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."billing_stays" ADD CONSTRAINT "billing_stays_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."adverse_events" ADD CONSTRAINT "adverse_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "tenant_template"."patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."adverse_events" ADD CONSTRAINT "adverse_events_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "tenant_template"."stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;
