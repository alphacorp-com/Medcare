-- Ensure yearly plan exists
INSERT INTO "public"."plans" (
  "id",
  "name",
  "tier",
  "billing_cycle",
  "base_price",
  "currency",
  "features",
  "is_active",
  "is_public",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  uuid_generate_v4(),
  'MedCare Yearly',
  'core'::"public"."PlanTier",
  'annual'::"public"."BillingCycle",
  1600000.00,
  'XAF',
  '{"support":"priority","billing":true,"analytics":true}'::jsonb,
  true,
  true,
  2,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."plans"
  WHERE "name" = 'MedCare Yearly'
    AND "billing_cycle" = 'annual'::"public"."BillingCycle"
);

-- Link existing tenant (db_schema = public) to an annual subscription that ended in March 2026.
INSERT INTO "public"."subscriptions" (
  "id",
  "tenant_id",
  "plan_id",
  "status",
  "current_period_start",
  "current_period_end",
  "cancelled_at",
  "cancel_reason",
  "seats_count",
  "beds_count",
  "mrr",
  "currency",
  "created_at",
  "updated_at"
)
SELECT
  uuid_generate_v4(),
  t."id",
  p."id",
  'cancelled'::"public"."SubscriptionStatus",
  '2025-04-01T00:00:00Z'::timestamptz,
  '2026-03-31T23:59:59Z'::timestamptz,
  '2026-03-31T23:59:59Z'::timestamptz,
  'Annual subscription ended in March 2026',
  5,
  0,
  133333.33,
  'XAF',
  NOW(),
  NOW()
FROM "public"."tenants" t
JOIN "public"."plans" p
  ON p."name" = 'MedCare Yearly'
 AND p."billing_cycle" = 'annual'::"public"."BillingCycle"
WHERE t."db_schema" = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."subscriptions" s
    WHERE s."tenant_id" = t."id"
      AND s."plan_id" = p."id"
      AND s."current_period_start" = '2025-04-01T00:00:00Z'::timestamptz
      AND s."current_period_end" = '2026-03-31T23:59:59Z'::timestamptz
  );
