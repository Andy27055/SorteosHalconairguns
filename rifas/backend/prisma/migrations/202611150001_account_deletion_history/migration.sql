-- Used or revoked benefits remain part of the raffle's history after account deletion.
ALTER TABLE "FreeTicketBenefit" ALTER COLUMN "userId" DROP NOT NULL;
