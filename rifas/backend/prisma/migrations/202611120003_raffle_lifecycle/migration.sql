ALTER TYPE "RaffleStatus" ADD VALUE 'CLOSING';
ALTER TYPE "RaffleStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "Raffle" ADD COLUMN "closingAt" TIMESTAMP(3), ADD COLUMN "resultDate" TEXT, ADD COLUMN "closedEarly" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "closingNote" TEXT, ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "cancellationReason" TEXT, ADD COLUMN "cancellationBuyers" JSONB;
CREATE INDEX "Raffle_status_drawAt_idx" ON "Raffle"("status","drawAt");
CREATE TYPE "RaffleEmailKind" AS ENUM ('RAFFLE_CANCELLED','RAFFLE_EARLY_CLOSURE','RAFFLE_RESULT_ADMIN');
CREATE TABLE "RaffleEmail" (
 "id" TEXT NOT NULL PRIMARY KEY, "raffleId" TEXT NOT NULL REFERENCES "Raffle"("id") ON DELETE RESTRICT,
 "eventKey" TEXT NOT NULL UNIQUE, "kind" "RaffleEmailKind" NOT NULL, "toEmail" TEXT NOT NULL, "adminUserId" TEXT,
 "payload" JSONB NOT NULL, "status" "EmailStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3), "lastErrorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RaffleEmail_status_nextAttemptAt_idx" ON "RaffleEmail"("status","nextAttemptAt");
CREATE TABLE "LotteryDraw" ("date" TEXT NOT NULL PRIMARY KEY, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
