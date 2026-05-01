-- CreateEnum
CREATE TYPE "public"."LicenseKeyStatus" AS ENUM ('generated', 'redeemed', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "public"."license_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "key_hash" VARCHAR(128) NOT NULL,
    "key_preview" VARCHAR(32) NOT NULL,
    "period" "public"."BillingCycle" NOT NULL,
    "status" "public"."LicenseKeyStatus" NOT NULL DEFAULT 'generated',
    "issued_by" UUID,
    "redeemed_by" UUID,
    "redeemed_at" TIMESTAMPTZ,
    "valid_from" TIMESTAMPTZ,
    "valid_until" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_keys_key_hash_key" ON "public"."license_keys"("key_hash");

-- CreateIndex
CREATE INDEX "license_keys_tenant_id_status_idx" ON "public"."license_keys"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "license_keys_valid_until_idx" ON "public"."license_keys"("valid_until");

-- AddForeignKey
ALTER TABLE "public"."license_keys" ADD CONSTRAINT "license_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."license_keys" ADD CONSTRAINT "license_keys_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
