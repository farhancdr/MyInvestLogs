-- Business type and industry were two free-text fields describing the same
-- thing, and only industry drives anything (allocation and drift group by it).
-- One field, chosen from a list, keeps those groupings from fragmenting into
-- "Food & Beverage" / "food and beverage" / "Restaurant".
ALTER TABLE businesses DROP COLUMN business_type;
