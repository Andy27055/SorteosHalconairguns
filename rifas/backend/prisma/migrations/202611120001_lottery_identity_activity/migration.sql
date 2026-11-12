ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Raffle" ADD COLUMN "numberStart" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Raffle" ALTER COLUMN "numberStart" SET DEFAULT 0;
ALTER TABLE "Raffle" ADD COLUMN "lotteryDigits" INTEGER DEFAULT 2;
UPDATE "Raffle" SET "lotteryDigits" = NULL WHERE "totalTickets" <> 100;
ALTER TABLE "Raffle" ADD COLUMN "lotteryResult" JSONB;
ALTER TABLE "Raffle" ADD COLUMN "winnerOrderId" TEXT;
ALTER TABLE "Raffle" ADD COLUMN "winnerDisplayName" TEXT;
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_number_start" CHECK ("numberStart" IN (0,1));
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_lottery_digits" CHECK ("lotteryDigits" BETWEEN 1 AND 4);
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_number_positive";
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_number_range" CHECK ("number" BETWEEN 0 AND 10000);
ALTER TYPE "OrderEmailKind" ADD VALUE 'RAFFLE_WINNER';
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" "Role";
UPDATE "AuditLog" a SET "actorRole" = u.role FROM "User" u WHERE a."actorId" = u.id;
CREATE TABLE "EmailVerification" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "email" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
 "status" "EmailStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "lockedAt" TIMESTAMP(3), "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3), "lastErrorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailVerification_status_nextAttemptAt_idx" ON "EmailVerification"("status","nextAttemptAt");
CREATE INDEX "EmailVerification_userId_createdAt_idx" ON "EmailVerification"("userId","createdAt");
