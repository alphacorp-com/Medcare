-- Adds the tables introduced with the organization-setup / role-management and
-- on-prem licensing features, which were added to schema.prisma without a
-- migration. Existing users' legacy enum role is converted into a per-tenant
-- Role row so no account loses its role.

-- CreateTable
CREATE TABLE "onprem_license" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "token" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "modules" TEXT[],
    "max_users" INTEGER,
    "max_beds" INTEGER,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_until" TIMESTAMPTZ NOT NULL,
    "grace_period_days" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_known_good_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "onprem_license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_system_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_clinical_provider" BOOLEAN NOT NULL DEFAULT false,
    "default_modules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "tenant_template"."roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "tenant_template"."roles"("tenant_id", "name");

-- Backfill: one Role per (tenant, legacy role) actually in use. Users without
-- a tenant_id belong to the install's single "public" tenant (falling back to
-- the oldest tenant).
ALTER TABLE "tenant_template"."tenant_users" ADD COLUMN "role_id" UUID;

CREATE TEMP TABLE "_legacy_role_map" AS
SELECT
    u."id" AS "user_id",
    COALESCE(
        u."tenant_id",
        (SELECT t."id" FROM "tenants" t ORDER BY (t."db_schema" = 'public') DESC, t."created_at" ASC LIMIT 1)
    ) AS "tenant_id",
    u."role"::text AS "legacy_role"
FROM "tenant_template"."tenant_users" u;

INSERT INTO "tenant_template"."roles" ("id", "tenant_id", "name", "is_system_admin", "is_clinical_provider", "updated_at")
SELECT
    gen_random_uuid(),
    m."tenant_id",
    CASE m."legacy_role"
        WHEN 'tenant_admin' THEN 'Administrator'
        WHEN 'doctor'       THEN 'Doctor'
        WHEN 'nurse'        THEN 'Nurse'
        WHEN 'pharmacist'   THEN 'Pharmacist'
        WHEN 'lab_tech'     THEN 'Lab Technician'
        WHEN 'radiologist'  THEN 'Radiologist'
        WHEN 'billing'      THEN 'Billing'
        WHEN 'hr'           THEN 'HR'
        ELSE 'Viewer'
    END,
    m."legacy_role" = 'tenant_admin',
    m."legacy_role" = 'doctor',
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "tenant_id", "legacy_role" FROM "_legacy_role_map" WHERE "tenant_id" IS NOT NULL) m;

UPDATE "tenant_template"."tenant_users" u
SET "role_id" = r."id"
FROM "_legacy_role_map" m
JOIN "tenant_template"."roles" r
  ON r."tenant_id" = m."tenant_id"
 AND r."name" = CASE m."legacy_role"
        WHEN 'tenant_admin' THEN 'Administrator'
        WHEN 'doctor'       THEN 'Doctor'
        WHEN 'nurse'        THEN 'Nurse'
        WHEN 'pharmacist'   THEN 'Pharmacist'
        WHEN 'lab_tech'     THEN 'Lab Technician'
        WHEN 'radiologist'  THEN 'Radiologist'
        WHEN 'billing'      THEN 'Billing'
        WHEN 'hr'           THEN 'HR'
        ELSE 'Viewer'
    END
WHERE u."id" = m."user_id";

DROP TABLE "_legacy_role_map";

-- AlterTable
ALTER TABLE "tenant_template"."tenant_users" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "tenant_template"."tenant_users" DROP COLUMN "role";

-- DropEnum
DROP TYPE "tenant_template"."TenantUserRole";

-- CreateIndex
CREATE INDEX "tenant_users_role_id_idx" ON "tenant_template"."tenant_users"("role_id");

-- AddForeignKey
ALTER TABLE "tenant_template"."tenant_users" ADD CONSTRAINT "tenant_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tenant_template"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
