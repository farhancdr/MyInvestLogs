-- Allocation targets: the share of outstanding capital you intend to hold in a
-- business or an industry. Concentration is the dominant risk in private
-- investing, so an intended shape is worth recording and measuring against.

CREATE TABLE allocation_targets (
  scope      TEXT NOT NULL CHECK (scope IN ('business', 'industry')),
  key        TEXT NOT NULL,
  target_pct REAL NOT NULL CHECK (target_pct >= 0 AND target_pct <= 100),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

INSERT OR IGNORE INTO settings (key, value, type, description) VALUES
  ('drift_band_pct', '5', 'number',
   'Percentage points a holding may drift from its target before it is flagged'),
  ('stale_valuation_months', '12', 'number',
   'Months before an outstanding investment is considered to need revaluation'),
  ('inactivity_months', '6', 'number',
   'Months without a payment before an active investment is flagged as quiet');
