ALTER TABLE "User" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT;
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "guestTokenHash" TEXT, ADD COLUMN "guestClientHash" TEXT,
  ADD COLUMN "buyerEmail" TEXT, ADD COLUMN "buyerFirstName" TEXT, ADD COLUMN "buyerLastName" TEXT, ADD COLUMN "buyerDni" TEXT;
CREATE UNIQUE INDEX "Order_guestTokenHash_key" ON "Order"("guestTokenHash");
CREATE INDEX "Order_guestClientHash_status_expiresAt_idx" ON "Order"("guestClientHash", "status", "expiresAt");
CREATE TYPE "EmailStatus" AS ENUM ('PENDING','SENDING','SENT','FAILED','SKIPPED');
CREATE TABLE "PurchaseEmail" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "toEmail" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
  "lastErrorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseEmail_orderId_key" ON "PurchaseEmail"("orderId");
CREATE INDEX "PurchaseEmail_status_nextAttemptAt_idx" ON "PurchaseEmail"("status", "nextAttemptAt");
ALTER TABLE "PurchaseEmail" ADD CONSTRAINT "PurchaseEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
