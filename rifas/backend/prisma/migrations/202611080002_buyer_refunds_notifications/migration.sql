ALTER TYPE "OrderStatus" ADD VALUE 'REFUND_PENDING';
ALTER TABLE "Order"
  ADD COLUMN "rejectionReasonCode" TEXT,
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundCompletedAt" TIMESTAMP(3),
  ADD COLUMN "refundAmountCents" INTEGER,
  ADD COLUMN "refundReference" TEXT;
CREATE TYPE "OrderEmailKind" AS ENUM ('PURCHASE_CONFIRMED','PURCHASE_REJECTED','REFUND_REQUESTED','REFUND_COMPLETED');
ALTER TABLE "PurchaseEmail" ADD COLUMN "kind" "OrderEmailKind" NOT NULL DEFAULT 'PURCHASE_CONFIRMED', ADD COLUMN "eventKey" TEXT;
UPDATE "PurchaseEmail" SET "eventKey" = 'PURCHASE_CONFIRMED:' || "orderId";
ALTER TABLE "PurchaseEmail" ALTER COLUMN "eventKey" SET NOT NULL;
DROP INDEX "PurchaseEmail_orderId_key";
CREATE UNIQUE INDEX "PurchaseEmail_eventKey_key" ON "PurchaseEmail"("eventKey");
CREATE INDEX "PurchaseEmail_orderId_idx" ON "PurchaseEmail"("orderId");
