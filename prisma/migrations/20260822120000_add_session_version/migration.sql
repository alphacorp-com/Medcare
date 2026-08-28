-- AlterTable
ALTER TABLE "public"."admin_users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenant_template"."tenant_users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;
