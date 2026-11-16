BEGIN;
ALTER TABLE "Order" DROP CONSTRAINT "Order_price_positive";
-- Only a recorded prize redemption can have zero price; paid purchases remain positive.
ALTER TABLE "Order" ADD CONSTRAINT "Order_price_positive" CHECK (
 ("method" = 'FREE_TICKET' AND "unitPriceCents" = 0 AND "amountCents" = 0)
 OR ("method" IS DISTINCT FROM 'FREE_TICKET' AND "unitPriceCents" > 0)
);
COMMIT;
