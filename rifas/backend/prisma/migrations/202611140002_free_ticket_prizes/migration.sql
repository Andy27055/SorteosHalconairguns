ALTER TYPE "PaymentMethod" ADD VALUE 'FREE_TICKET';
CREATE TYPE "PrizeKind" AS ENUM ('ITEM', 'FREE_TICKET');
BEGIN;
ALTER TABLE "Prize" ADD COLUMN "kind" "PrizeKind" NOT NULL DEFAULT 'ITEM';
ALTER TABLE "AwardPrize" ADD COLUMN "kind" "PrizeKind" NOT NULL DEFAULT 'ITEM';
ALTER TABLE "Raffle" ADD COLUMN "openedAt" TIMESTAMP(3);
UPDATE "Raffle" SET "openedAt"="createdAt" WHERE "status" <> 'DRAFT';
CREATE TABLE "FreeTicketBenefit" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "awardPrizeId" TEXT NOT NULL REFERENCES "AwardPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
 "remaining" INTEGER NOT NULL CHECK ("remaining" >= 0 AND "remaining" <= "quantity"),
 "targetRaffleId" TEXT REFERENCES "Raffle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FreeTicketBenefit_awardPrizeId_key" ON "FreeTicketBenefit"("awardPrizeId");
CREATE INDEX "FreeTicketBenefit_userId_revokedAt_remaining_idx" ON "FreeTicketBenefit"("userId","revokedAt","remaining");
CREATE TABLE "FreeTicketUse" (
 "id" TEXT PRIMARY KEY,
 "benefitId" TEXT NOT NULL REFERENCES "FreeTicketBenefit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
 "restoredAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "FreeTicketUse_benefitId_orderId_key" ON "FreeTicketUse"("benefitId","orderId");
COMMIT;
