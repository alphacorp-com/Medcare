-- CreateIndex
CREATE INDEX "patients_tenant_id_last_name_first_name_birth_date_idx" ON "tenant_template"."patients"("tenant_id", "last_name", "first_name", "birth_date");
