-- Fields the deal sheet proves matter, and that the app had nowhere to put.
--
-- payout_cycle is deliberately separate from the rate: a deal can accrue 2% a
-- month and hand it over once a quarter. Treating those as one number computes
-- the wrong expectation.
ALTER TABLE investments ADD COLUMN deal_structure TEXT NOT NULL DEFAULT '';
ALTER TABLE investments ADD COLUMN payout_cycle   TEXT NOT NULL DEFAULT '';
-- Comma-separated: cheque and a legal agreement usually both apply.
ALTER TABLE investments ADD COLUMN security       TEXT NOT NULL DEFAULT '';

-- Maturity of the business, independent of how risky the deal is.
ALTER TABLE businesses ADD COLUMN stage                TEXT NOT NULL DEFAULT '';
-- Account name, number, routing, branch — kept with the business, not retyped.
ALTER TABLE businesses ADD COLUMN payment_instructions TEXT NOT NULL DEFAULT '';
