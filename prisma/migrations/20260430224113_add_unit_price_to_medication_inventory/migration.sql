-- AlterTable
ALTER TABLE "medication_inventory" ADD COLUMN     "unit_price" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "modules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tenant_id" UUID;
