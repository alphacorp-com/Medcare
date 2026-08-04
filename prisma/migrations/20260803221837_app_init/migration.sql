-- AlterTable
ALTER TABLE "public"."license_keys" ADD COLUMN     "subscription_id" UUID;

-- CreateIndex
CREATE INDEX "license_keys_subscription_id_idx" ON "public"."license_keys"("subscription_id");

-- AddForeignKey
ALTER TABLE "public"."license_keys" ADD CONSTRAINT "license_keys_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
