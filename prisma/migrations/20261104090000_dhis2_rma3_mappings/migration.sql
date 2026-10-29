-- Rapprochement des valeurs du RMA3 avec le DHIS2 national : (code d'indicateur, table, case) ->
-- élément de données (+ combinaison de catégories). Le code seul ne suffit pas : le RMA3 réutilise
-- ses codes (II.2-001 désigne un dépistage dans une table, un cancer du sein confirmé dans une autre). Table additive : aucune donnée existante n'est touchée.
CREATE TABLE "tenant_template"."dhis2_rma3_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "indicator_code" VARCHAR(40) NOT NULL,
    "table_key" VARCHAR(120) NOT NULL,
    "cell_key" VARCHAR(80) NOT NULL DEFAULT '',
    "data_element_id" VARCHAR(11) NOT NULL,
    "category_option_combo_id" VARCHAR(11),
    "source" VARCHAR(10) NOT NULL DEFAULT 'manual',
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "dhis2_rma3_mappings_pkey" PRIMARY KEY ("id"),
    -- A DHIS2 UID: a letter, then 10 letters or digits.
    CONSTRAINT "dhis2_rma3_mappings_data_element_check" CHECK ("data_element_id" ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
    CONSTRAINT "dhis2_rma3_mappings_coc_check" CHECK ("category_option_combo_id" IS NULL OR "category_option_combo_id" ~ '^[A-Za-z][A-Za-z0-9]{10}$')
);
CREATE UNIQUE INDEX "dhis2_rma3_mappings_tenant_id_indicator_code_table_key_cell_key_key" ON "tenant_template"."dhis2_rma3_mappings"("tenant_id", "indicator_code", "table_key", "cell_key");
CREATE INDEX "dhis2_rma3_mappings_tenant_id_idx" ON "tenant_template"."dhis2_rma3_mappings"("tenant_id");
