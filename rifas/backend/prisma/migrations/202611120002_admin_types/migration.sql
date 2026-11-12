CREATE TYPE "AdminType" AS ENUM ('PRIMARY', 'FUNCTIONAL');
ALTER TABLE "User" ADD COLUMN "adminType" "AdminType";
UPDATE "User" SET "adminType" = 'FUNCTIONAL' WHERE "role" = 'ADMIN';
ALTER TABLE "User" ADD CONSTRAINT "User_admin_type_role" CHECK ("role" = 'ADMIN' OR "adminType" IS NULL);
CREATE UNIQUE INDEX "User_one_active_primary" ON "User"("adminType") WHERE "adminType" = 'PRIMARY' AND "active" = true;
