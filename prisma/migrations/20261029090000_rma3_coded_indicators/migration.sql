-- RMA3 indicators from coded diagnoses, acts and treatments (chantier C02): suspected
-- diagnoses, the RMA3 act indicator of a medical act, the RMA3 child treatment of a stock
-- article, and the WHO ICD-10 sub-codes the RMA3 needs (leprosy PB / MB, leishmaniasis and
-- schistosomiasis forms, trachoma sequelae / trichiasis, Buruli ulcer). Additive only.
-- AlterTable
ALTER TABLE "tenant_template"."diagnoses" ADD COLUMN     "is_suspected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenant_template"."medication_inventory" ADD COLUMN     "rma3_treatment" VARCHAR(20);

-- AlterTable
ALTER TABLE "tenant_template"."medical_acts" ADD COLUMN     "rma3_indicator" VARCHAR(30);


-- ICD-10 sub-codes for every facility that already has a catalog (new facilities get them
-- from the seed). Existing codes are left untouched.
INSERT INTO "tenant_template"."icd10_codes" ("id", "tenant_id", "code", "label_fr", "chapter", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), t."tenant_id", v."code", v."label_fr", v."chapter", true, now(), now()
FROM (SELECT DISTINCT "tenant_id" FROM "tenant_template"."icd10_codes" WHERE "tenant_id" IS NOT NULL) t
CROSS JOIN (VALUES
  ('A30.0', 'Lèpre indéterminée', 'Maladies infectieuses et parasitaires'),
  ('A30.1', 'Lèpre tuberculoïde', 'Maladies infectieuses et parasitaires'),
  ('A30.2', 'Lèpre tuberculoïde borderline', 'Maladies infectieuses et parasitaires'),
  ('A30.3', 'Lèpre borderline', 'Maladies infectieuses et parasitaires'),
  ('A30.4', 'Lèpre lépromateuse borderline', 'Maladies infectieuses et parasitaires'),
  ('A30.5', 'Lèpre lépromateuse', 'Maladies infectieuses et parasitaires'),
  ('A31', 'Infections dues à d''autres mycobactéries', 'Maladies infectieuses et parasitaires'),
  ('A31.1', 'Infection cutanée à mycobactéries (ulcère de Buruli)', 'Maladies infectieuses et parasitaires'),
  ('B55.0', 'Leishmaniose viscérale', 'Maladies infectieuses et parasitaires'),
  ('B55.1', 'Leishmaniose cutanée', 'Maladies infectieuses et parasitaires'),
  ('B55.2', 'Leishmaniose cutanéo-muqueuse', 'Maladies infectieuses et parasitaires'),
  ('B65.0', 'Schistosomiase à Schistosoma haematobium (bilharziose urinaire)', 'Maladies infectieuses et parasitaires'),
  ('B65.1', 'Schistosomiase à Schistosoma mansoni (bilharziose intestinale)', 'Maladies infectieuses et parasitaires'),
  ('B65.2', 'Schistosomiase à Schistosoma japonicum', 'Maladies infectieuses et parasitaires'),
  ('B94', 'Séquelles d''autres maladies infectieuses et parasitaires', 'Maladies infectieuses et parasitaires'),
  ('B94.0', 'Séquelles de trachome', 'Maladies infectieuses et parasitaires'),
  ('H02', 'Autres affections des paupières', 'Maladies de l''œil et de ses annexes'),
  ('H02.0', 'Entropion et trichiasis de la paupière', 'Maladies de l''œil et de ses annexes')
) AS v("code", "label_fr", "chapter")
ON CONFLICT ("tenant_id", "code") DO NOTHING;

-- Defence in depth: the codes the application accepts (lib/reports/rma3-acts.ts, lib/stock/input.ts).
ALTER TABLE "tenant_template"."medication_inventory" ADD CONSTRAINT "medication_inventory_rma3_treatment_check" CHECK ("rma3_treatment" IS NULL OR "rma3_treatment" IN ('ors', 'zinc', 'antibiotic'));
