BEGIN;
CREATE TABLE "RaffleAward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raffleId" TEXT NOT NULL REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rank" INTEGER NOT NULL CHECK ("rank" BETWEEN 1 AND 20),
  "winningNumber" INTEGER,
  "officialNumber" TEXT,
  "winnerOrderId" TEXT REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "winnerDisplayName" TEXT
);
CREATE UNIQUE INDEX "RaffleAward_raffleId_rank_key" ON "RaffleAward"("raffleId", "rank");
CREATE TABLE "AwardPrize" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "awardId" TEXT NOT NULL REFERENCES "RaffleAward"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "prizeId" TEXT NOT NULL REFERENCES "Prize"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "AwardPrize_awardId_prizeId_key" ON "AwardPrize"("awardId", "prizeId");
-- Preserve existing rules and published results as a single first-place award.
INSERT INTO "RaffleAward" ("id", "raffleId", "rank", "winningNumber", "officialNumber", "winnerOrderId", "winnerDisplayName")
SELECT 'legacy-award-' || "id", "id", 1, "winnerNumber", "lotteryResult"->>'head', "winnerOrderId", "winnerDisplayName" FROM "Raffle";
INSERT INTO "AwardPrize" ("id", "awardId", "prizeId", "name", "description", "quantity")
SELECT 'legacy-prize-' || r."id", 'legacy-award-' || r."id", p."id", p."name", p."description", 1 FROM "Raffle" r JOIN "Prize" p ON p."id"=r."prizeId";
COMMIT;
