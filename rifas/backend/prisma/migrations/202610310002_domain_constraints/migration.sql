ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_price_positive" CHECK ("ticketPriceCents" > 0);
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_ticket_range" CHECK ("totalTickets" BETWEEN 1 AND 10000);
ALTER TABLE "Order" ADD CONSTRAINT "Order_price_positive" CHECK ("unitPriceCents" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amount_matches_numbers" CHECK (cardinality("numbers") BETWEEN 1 AND 20 AND "amountCents" = "unitPriceCents" * cardinality("numbers"));
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_number_positive" CHECK ("number" BETWEEN 1 AND 10000);
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_size_limit" CHECK ("size" BETWEEN 1 AND 5242880);
