ALTER TYPE "OrderEmailKind" ADD VALUE 'REFUND_REQUEST_RECEIVED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'REFUND_REQUEST_APPROVED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'REFUND_REQUEST_REJECTED';

ALTER TABLE "Order" ADD COLUMN "parentOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "originalNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Order" ADD COLUMN "originalAmountCents" INTEGER;
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Order_parentOrderId_idx" ON "Order"("parentOrderId");

CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
CREATE TABLE "RefundRequest" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orderId" TEXT NOT NULL,
 "numbers" INTEGER[] NOT NULL,
 "amountCents" INTEGER NOT NULL CHECK ("amountCents">0),
 "reason" TEXT NOT NULL DEFAULT '',
 "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
 "requestKey" TEXT NOT NULL,
 "reviewedBy" TEXT,
 "reviewedAt" TIMESTAMP(3),
 "decisionNote" TEXT,
 "refundOrderId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "RefundRequest_refundOrderId_fkey" FOREIGN KEY ("refundOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RefundRequest_requestKey_key" ON "RefundRequest"("requestKey");
CREATE UNIQUE INDEX "RefundRequest_refundOrderId_key" ON "RefundRequest"("refundOrderId");
CREATE UNIQUE INDEX "RefundRequest_one_pending_per_order" ON "RefundRequest"("orderId") WHERE "status"='PENDING';
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status","createdAt");
CREATE INDEX "RefundRequest_orderId_createdAt_idx" ON "RefundRequest"("orderId","createdAt");
