-- RMA3 monthly form: values no transaction records (community activity, supervisions,
-- environment, income outside billing, expenses), entered and validated once a month.
-- Additive only: two new tables and one enum.
-- CreateEnum
CREATE TYPE "tenant_template"."Rma3PeriodStatus" AS ENUM ('draft', 'validated');

-- CreateTable
CREATE TABLE "tenant_template"."rma3_manual_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period" CHAR(6) NOT NULL,
    "status" "tenant_template"."Rma3PeriodStatus" NOT NULL DEFAULT 'draft',
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rma3_manual_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."rma3_manual_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "indicator_code" VARCHAR(30) NOT NULL,
    "breakdown_key" VARCHAR(40) NOT NULL DEFAULT '',
    "value" DECIMAL(15,0) NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rma3_manual_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rma3_manual_periods_tenant_id_period_key" ON "tenant_template"."rma3_manual_periods"("tenant_id", "period");

-- CreateIndex
CREATE INDEX "rma3_manual_values_tenant_id_idx" ON "tenant_template"."rma3_manual_values"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rma3_manual_values_period_id_indicator_code_breakdown_key_key" ON "tenant_template"."rma3_manual_values"("period_id", "indicator_code", "breakdown_key");

-- AddForeignKey
ALTER TABLE "tenant_template"."rma3_manual_values" ADD CONSTRAINT "rma3_manual_values_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "tenant_template"."rma3_manual_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Defence in depth (the API validates first): no negative value, a well-formed period.
ALTER TABLE "tenant_template"."rma3_manual_values" ADD CONSTRAINT "rma3_manual_values_value_check" CHECK ("value" >= 0);
ALTER TABLE "tenant_template"."rma3_manual_periods" ADD CONSTRAINT "rma3_manual_periods_period_check" CHECK ("period" ~ '^[0-9]{4}(0[1-9]|1[0-2])$');
