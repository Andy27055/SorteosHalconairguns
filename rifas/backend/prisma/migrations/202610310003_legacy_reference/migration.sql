ALTER TABLE "Order" ADD COLUMN "legacyReference" TEXT;
CREATE UNIQUE INDEX "Order_legacyReference_key" ON "Order"("legacyReference");
