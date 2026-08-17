-- Initial schema (PRD §7). Sheets become tables almost one-to-one, per §33.

CREATE TABLE businesses (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  business_type  TEXT NOT NULL DEFAULT '',
  industry       TEXT NOT NULL DEFAULT '',
  owner          TEXT NOT NULL DEFAULT '',
  contact        TEXT NOT NULL DEFAULT '',
  location       TEXT NOT NULL DEFAULT '',
  start_date     TEXT,
  status         TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  risk_level     TEXT NOT NULL DEFAULT 'Medium',
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE investments (
  id                      TEXT PRIMARY KEY,
  business_id             TEXT NOT NULL REFERENCES businesses(id),
  name                    TEXT NOT NULL,
  investment_date         TEXT NOT NULL,
  initial_investment      REAL NOT NULL CHECK (initial_investment > 0),
  currency                TEXT NOT NULL DEFAULT 'BDT',
  return_model            TEXT NOT NULL,
  promised_return_pct     REAL,
  monthly_return_pct      REAL,
  expected_monthly_return REAL,
  investment_term         INTEGER,
  maturity_date           TEXT,
  principal_repayment     INTEGER NOT NULL DEFAULT 1,
  status                  TEXT NOT NULL,
  risk_level              TEXT NOT NULL DEFAULT 'Medium',
  agreement_reference     TEXT NOT NULL DEFAULT '',
  notes                   TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

-- Expected Total Return and the business's first-investment date are derived
-- on read and deliberately absent as columns (PRD §7.2, §7.3).

CREATE TABLE transactions (
  id                TEXT PRIMARY KEY,
  investment_id     TEXT NOT NULL REFERENCES investments(id),
  business_id       TEXT NOT NULL REFERENCES businesses(id),
  date              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN
                      ('Investment','Profit','Principal Return','Fee','Loss','Adjustment')),
  -- Always positive; direction is derived from type (PRD §7.4).
  amount            REAL NOT NULL CHECK (amount > 0),
  payment_method    TEXT NOT NULL DEFAULT '',
  reference         TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  attachment        TEXT NOT NULL DEFAULT '',
  adjusts           TEXT REFERENCES transactions(id),
  adjustment_effect TEXT CHECK (adjustment_effect IN ('Increase','Decrease')),
  created_at        TEXT NOT NULL,

  -- Only adjustments reference another row, and they must state a direction.
  CHECK ((type = 'Adjustment') = (adjusts IS NOT NULL)),
  CHECK ((type = 'Adjustment') = (adjustment_effect IS NOT NULL))
);

CREATE INDEX idx_transactions_investment ON transactions(investment_id);
CREATE INDEX idx_transactions_business ON transactions(business_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_investments_business ON investments(business_id);

-- Append-only, enforced by the database rather than by convention (PRD §22).
-- A correction is a new Adjustment row; the original is never altered.
CREATE TRIGGER transactions_no_update BEFORE UPDATE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'Transactions are append-only. Record an Adjustment instead.');
END;

-- Deletion is blocked too, with one exception: seeded sample rows, which carry
-- a visible [sample] marker so the cleanup script can remove exactly those.
CREATE TRIGGER transactions_no_delete BEFORE DELETE ON transactions
WHEN OLD.description NOT LIKE '%[sample]%'
BEGIN
  SELECT RAISE(ABORT, 'Transactions are append-only. Only sample rows may be deleted.');
END;

CREATE TABLE valuations (
  id              TEXT PRIMARY KEY,
  investment_id   TEXT NOT NULL REFERENCES investments(id),
  date            TEXT NOT NULL,
  estimated_value REAL NOT NULL,
  method          TEXT NOT NULL DEFAULT '',
  confidence      TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT ''
);

-- Phase 2 tables. Created now so the schema is whole and no migration is
-- needed later; nothing writes to them yet.
CREATE TABLE expected_payments (
  id                     TEXT PRIMARY KEY,
  investment_id          TEXT NOT NULL REFERENCES investments(id),
  expected_date          TEXT NOT NULL,
  expected_amount        REAL NOT NULL,
  payment_type           TEXT NOT NULL,
  matched_transaction_ids TEXT NOT NULL DEFAULT '',
  settlement             TEXT NOT NULL DEFAULT 'Unpaid',
  timeliness             TEXT NOT NULL DEFAULT 'Upcoming',
  notes                  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE notes (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id),
  investment_id TEXT REFERENCES investments(id),
  date          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Update',
  note          TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'string',
  description TEXT NOT NULL DEFAULT ''
);

-- Readable sequential IDs (PRD §36). Allocated inside the write transaction,
-- so concurrent writes cannot collide. Counters are never rewound.
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Ships from day one: a log added later has no history in it (PRD §22).
CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
