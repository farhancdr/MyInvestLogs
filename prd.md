# PRD — Personal Investment Tracker

## 1. Product Overview

### Product name

**Personal Investment Tracker**

### Purpose

A private investment tracking system built with **Google Sheets, Google Apps Script, and HTML/CSS/JavaScript** for tracking investments in small businesses, private ventures, partnerships, and other non-public investments.

The system will allow the user to:

1. Record every investment and transaction.
2. Maintain detailed information about each business.
3. Track promised/expected returns versus actual returns.
4. Track monthly, yearly, and lifetime investment performance.
5. Track cash invested, cash received, outstanding capital, and profit.
6. Calculate investment metrics such as ROI, annualized return, cash-on-cash return, and payback.
7. View the entire portfolio through a dashboard.
8. Identify which businesses/investments are performing well or poorly.
9. Maintain an auditable transaction history.
10. Manage everything through a simple HTML interface while Google Sheets acts as the database.

---

# 2. Goals

## Primary goals

### Portfolio visibility

At any time, the user should be able to answer:

* How much money have I invested?
* How much money have I received back?
* How much profit have I actually made?
* How much capital is still outstanding?
* How much am I expected to receive?
* What is my total ROI?
* What is my annualized return?
* Which investments are performing best?
* Which investments are underperforming?
* How much money is currently tied up?
* How much cash flow am I receiving every month?

### Investment-level visibility

For each investment:

* How much did I invest?
* When did I invest?
* What was promised?
* What has actually been paid?
* How much principal has been returned?
* How much profit has been received?
* How much remains outstanding?
* Is the investment currently active?
* Is it overdue?
* What is the actual return compared with the promised return?

### Business-level visibility

For each business:

* What does the business do?
* Who operates it?
* How much have I invested?
* What is the agreed return model?
* What is the expected payment schedule?
* How much have I received?
* What is the current status?
* What documents/agreements are associated with it?
* What notes or risks have been recorded?

---

# 3. Non-Goals

The MVP will NOT attempt to become:

* A full accounting system.
* A tax filing system.
* A stock-market portfolio tracker.
* A banking application.
* A business accounting system.
* A multi-user investment platform.
* An automated bank transaction importer.

The system is primarily a **personal investment monitoring tool**.

---

# 4. Technology

## Frontend

* HTML
* CSS
* Vanilla JavaScript
* Google Apps Script HTML Service

Optional:

* Chart.js for advanced charts
* Google Charts if keeping dependencies minimal

## Backend

* Google Apps Script
* Apps Script functions for CRUD operations
* Scheduled triggers for calculations/notifications

## Database

Google Sheets.

The spreadsheet should be treated as a relational database rather than as a manually edited spreadsheet.

Apps Script should be the primary interface for modifying data.

---

# 5. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │   HTML Dashboard     │
                    │  HTML/CSS/JavaScript │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Google Apps Script │
                    │                      │
                    │ CRUD + calculations  │
                    │ validation           │
                    │ reporting            │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Google Sheets    │
                    │                      │
                    │ Businesses           │
                    │ Investments          │
                    │ Transactions         │
                    │ Expected Payments    │
                    │ Valuations           │
                    │ Notes                │
                    │ Settings             │
                    │ AuditLog             │
                    └──────────────────────┘
```

---

# 6. Core Data Model

The most important design decision is to **separate Businesses, Investments, and Transactions**.

One business may have multiple investments.

For example:

```text
Business: ABC Restaurant

Investment #1
Invested: ৳500,000
Date: Jan 2026
Return model: 20% annual profit

Investment #2
Invested: ৳300,000
Date: Jun 2026
Return model: Monthly profit sharing
```

These should not be merged into one record.

---

# 7. Google Sheets Structure

The spreadsheet should contain the following sheets.

## 7.1 Dashboard

Presentation-only sheet.

Contains:

* Portfolio summary
* KPI cards
* Charts
* Investment performance
* Monthly cash flow
* Upcoming payments
* Alerts

No raw data should be stored here.

---

# 7.2 Businesses

Stores information about each business.

| Field                 | Description                              |
| --------------------- | ---------------------------------------- |
| Business ID           | Unique identifier                        |
| Business Name         | Name of business                         |
| Business Type         | Restaurant, shop, trading, service, etc. |
| Industry              | Business category                        |
| Owner/Operator        | Person/company operating it              |
| Contact               | Contact information                      |
| Location              | Business location                        |
| Start Date            | When business started                    |
| Status                | Active / Closed / Defaulted / Exited     |
| Description           | Business description                     |
| Risk Level            | Low / Medium / High — default inherited by new investments |
| Notes                 | Additional notes                         |
| Created At            | Record creation timestamp                |
| Updated At            | Last update                              |

**Derived, not stored:** `Investment Start Date` is the earliest `Investment Date` across the business's investments. It is computed on read, never written to the sheet.

**Risk precedence:** an investment's own `Risk Level` always wins. The business value is only the default applied when an investment is created.

---

# 7.3 Investments

Each investment is a separate record.

| Field                   | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| Investment ID           | Unique ID                                              |
| Business ID             | Related business                                       |
| Investment Name         | Human-readable name                                    |
| Investment Date         | Date capital was invested                              |
| Initial Investment      | Original capital                                       |
| Currency                | BDT                                                    |
| Return Model            | Fixed / Monthly / Revenue Share / Profit Share / Other |
| Promised Return %       | Agreed annual or total return                          |
| Monthly Return %        | If applicable                                          |
| Expected Monthly Return | Expected cash payment                                  |
| Investment Term         | Number of months                                       |
| Maturity Date           | Expected end date                                      |
| Principal Repayment     | Whether principal is returned                          |
| Status                  | Active / Matured / Exited / Defaulted                  |
| Risk Level              | Low / Medium / High — overrides the business value     |
| Agreement Reference     | Link/reference to agreement                            |
| Notes                   | Additional information                                 |
| Created At              | Timestamp                                              |
| Updated At              | Timestamp                                              |

**Derived, not stored:** `Expected Total Return` is always computable from the return model (§8) and is never written to the sheet. Storing it would let it go stale the moment any input changes.

Which of `Promised Return %`, `Monthly Return %`, and `Expected Monthly Return` are required, computed, or blank depends entirely on the return model — see the field matrix in §8.

---

# 7.4 Transactions

This is the most important sheet.

Every movement of money gets a transaction.

Examples:

```text
Invest ৳500,000
Receive profit ৳10,000
Receive principal ৳50,000
Receive profit ৳12,000
Invest additional ৳100,000
```

Each must be a separate transaction.

| Field          | Description                                                      |
| -------------- | ---------------------------------------------------------------- |
| Transaction ID | Unique ID                                                        |
| Investment ID  | Related investment                                               |
| Business ID    | Related business                                                 |
| Date           | Transaction date (ISO `yyyy-MM-dd`)                              |
| Type           | Investment / Profit / Principal Return / Fee / Loss / Adjustment |
| Amount         | Transaction amount — **always positive**                         |
| Payment Method | Bank / Cash / bKash / Nagad / Other                              |
| Reference      | Bank transaction/reference number                                |
| Description    | Notes                                                            |
| Attachment     | Optional document URL                                            |
| Adjusts        | For `Adjustment` / reversal rows: the Transaction ID being corrected |
| Adjustment Effect | For `Adjustment` rows: `Increase` or `Decrease`               |
| Created At     | Timestamp                                                        |

## Direction is derived, not stored

Storing both `Type` and `Direction` allows rows where the two disagree, and no validation can reliably tell which one was intended. Direction is therefore computed from `Type`:

| Type             | Direction | Effect on metrics                          |
| ---------------- | --------- | ------------------------------------------ |
| Investment       | Money Out | Increases capital invested and outstanding |
| Profit           | Money In  | Increases realized profit                  |
| Principal Return | Money In  | Reduces capital outstanding                |
| Fee              | Money Out | Reduces realized profit, never capital     |
| Loss             | —         | Writes off capital: reduces outstanding and reduces realized profit |
| Adjustment       | Either    | Corrects a prior row; signed by the row it adjusts |

`Amount` is always stored positive. Sign is applied by the calculation layer from `Type`.

An adjustment therefore needs its own direction, which is what `Adjustment Effect` carries. Without it, a correction of ৳10,000 against a ৳50,000 profit is ambiguous — it could mean ৳40,000 or ৳60,000. The alternative, allowing negative amounts on adjustment rows only, would contradict the positive-amount rule and weaken the validation that depends on it.

An adjustment applies its amount to the bucket of the row it corrects, in the direction given by `Adjustment Effect`. Orphaned adjustments — where the target no longer exists — contribute nothing.

## Transactions are append-only

No transaction is ever updated or deleted. This is the rule that makes the history trustworthy (§22).

A mistake is corrected by writing a new `Adjustment` transaction whose `Adjusts` field points at the original. The original row stays exactly as it was recorded.

---

# 7.5 Expected Payments

Used to track what should have been received.

| Field               | Description                                   |
| ------------------- | --------------------------------------------- |
| Payment ID             | Unique ID                                          |
| Investment ID          | Related investment                                 |
| Expected Date          | Payment due date (ISO `yyyy-MM-dd`)                |
| Expected Amount        | Expected amount                                    |
| Payment Type           | Profit / Principal / Other                         |
| Matched Transaction IDs | Comma-separated Transaction IDs settling this payment |
| Settlement             | Unpaid / Partial / Settled                         |
| Timeliness             | Upcoming / Due / Late / Missed                     |
| Notes                  | Additional notes                                   |

This allows the system to answer:

> "ABC Business should have paid me ৳30,000 by now but I only received ৳20,000."

## Transactions are the only source of truth

Actual received amount and actual payment date are **not stored here**. They are derived by summing the transactions listed in `Matched Transaction IDs`. Storing them alongside the transaction rows would create two records of the same money, and the two will eventually disagree.

## Two status axes, not one

A payment can be both partial and late at the same time, so a single status column cannot express reality. Settlement and timeliness are tracked separately:

| Settlement | Meaning                                        |
| ---------- | ---------------------------------------------- |
| Unpaid     | No matched transactions                        |
| Partial    | Matched total is below Expected Amount         |
| Settled    | Matched total meets or exceeds Expected Amount |

| Timeliness | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| Upcoming   | Expected Date is in the future                               |
| Due        | Expected Date has passed, still inside the grace period      |
| Late       | Past the grace period, not yet settled                       |
| Missed     | Past the grace period by a full period, still unsettled      |

Timeliness stops advancing once Settlement reaches `Settled`.

## Generation rules

Expected payments are generated **on investment creation**, for Models A, B and E only. Models C and D have no computable schedule (§8) and generate nothing.

* One row per month of `Investment Term`, starting one month after `Investment Date`.
* Principal repayment, where `Principal Repayment` is true, generates one final row at `Maturity Date`.

On investment edit, unmatched future rows are regenerated. **Rows with matched transactions are never touched** — history is not rewritten because a forward-looking assumption changed.

## Matching rules

Matching is **explicit**, not automatic. When a transaction is recorded the UI offers the open expected payments for that investment, and the user confirms which one it settles. A transaction may also be recorded with no match at all.

Automatic date-and-amount matching was considered and rejected: a wrong guess silently marks an unpaid obligation as settled, which is precisely the error this sheet exists to catch.

---

# 7.6 Valuations

Useful for investments where the investment value changes but cash has not yet been received.

| Field            | Description                        |
| ---------------- | ---------------------------------- |
| Valuation ID     | Unique ID                          |
| Investment ID    | Related investment                 |
| Date             | Valuation date                     |
| Estimated Value  | Current estimated investment value |
| Valuation Method | Manual / Business reported / Other |
| Confidence       | Low / Medium / High                |
| Notes            | Explanation                        |

This is particularly useful for investments where the principal isn't automatically returned.

---

# 7.7 Investment Notes

Stores qualitative information.

| Field         | Description                               |
| ------------- | ----------------------------------------- |
| Note ID       | Unique ID                                 |
| Business ID   | Business                                  |
| Investment ID | Optional investment                       |
| Date          | Note date                                 |
| Category      | Update / Risk / Meeting / Payment / Issue |
| Note          | Content                                   |
| Created At    | Timestamp                                 |

---

# 7.8 Settings

Stores application configuration as typed key/value rows.

| Field       | Description                              |
| ----------- | ---------------------------------------- |
| Key         | Unique setting key                       |
| Value       | Setting value                            |
| Type        | number / string / boolean / list         |
| Description | What the setting controls                |

## Required keys and defaults

| Key                         | Type    | Default     | Controls                                          |
| --------------------------- | ------- | ----------- | ------------------------------------------------- |
| `currency`                  | string  | `BDT`       | Display currency                                  |
| `timezone`                  | string  | `Asia/Dhaka`| All date handling (§35)                           |
| `overdue_grace_days`        | number  | `3`         | Days past due before a payment is Late (§19)      |
| `upcoming_window_days`      | number  | `7`         | How far ahead upcoming payments are surfaced      |
| `underperform_threshold`    | number  | `0.80`      | Fraction of expected annualized return below which an investment is flagged |
| `concentration_threshold`   | number  | `0.30`      | Share of portfolio capital in one business before warning |
| `performer_min_months`      | number  | `3`         | Minimum holding period to appear in best/worst rankings (§20) |
| `max_annual_return_pct`     | number  | `200`       | Validation warning bound (§21)                    |
| `max_monthly_return_pct`    | number  | `20`        | Validation warning bound (§21)                    |
| `business_id_counter`       | number  | `0`         | ID allocation (§36)                               |
| `investment_id_counter`     | number  | `0`         | ID allocation (§36)                               |
| `transaction_id_counter`    | number  | `0`         | ID allocation (§36)                               |
| `payment_id_counter`        | number  | `0`         | ID allocation (§36)                               |

Enumerations — investment categories, transaction types, risk levels, status values — are also stored here as `list` rows so they can be extended without a code change.

---

# 7.9 AuditLog

Every mutation is logged. This sheet is **Phase 1**, not optional: an audit log added later contains no history of the period you would most want to inspect.

| Field     | Description                                     |
| --------- | ----------------------------------------------- |
| Timestamp | When the change occurred                        |
| User      | Active user email                               |
| Action    | create / update / void / adjust                 |
| Entity    | Business / Investment / Transaction / Payment / Valuation / Note |
| Entity ID | Affected record                                 |
| Details   | JSON of changed fields, before and after        |

The log is written inside the same script lock as the mutation itself (§36), so a logged change and the change itself cannot diverge.

---

# 8. Return Models

The system must support different investment structures.

## Model A — Fixed annual return

Example:

```text
Investment: ৳500,000
Promised return: 20% annually
Term: 12 months
```

Expected profit:

```text
৳500,000 × 20% = ৳100,000
```

Expected total:

```text
৳600,000
```

---

## Model B — Monthly fixed return

Example:

```text
Investment: ৳500,000
Monthly return: 2%
```

Expected monthly profit:

```text
৳10,000
```

The system should generate expected payment records.

---

## Model C — Profit sharing

Example:

```text
Investment: ৳500,000

Investor receives:
30% of distributable profit
```

Expected return cannot be calculated purely from the initial investment.

The user records actual profit distributions.

---

## Model D — Revenue sharing

Example:

```text
Investor receives:
5% of monthly revenue
```

Again, actual payments should be recorded as transactions.

---

## Model E — Custom

For unusual agreements.

The user manually defines:

* Expected payment
* Payment schedule
* Principal repayment
* Return assumptions

---

## Field matrix

Which investment fields apply is determined entirely by the return model. Fields marked blank must be empty — leaving a stale value in an inapplicable field is a common source of wrong expected-return figures.

| Field                     | A — Fixed annual | B — Monthly fixed | C — Profit share | D — Revenue share | E — Custom |
| ------------------------- | ---------------- | ----------------- | ---------------- | ----------------- | ---------- |
| `Promised Return %`       | **required**     | computed          | blank            | blank             | optional   |
| `Monthly Return %`        | blank            | **required**      | blank            | blank             | optional   |
| `Expected Monthly Return` | computed         | computed          | blank            | blank             | **required** |
| `Investment Term`         | **required**     | **required**      | optional         | optional          | **required** |
| `Maturity Date`           | computed         | computed          | optional         | optional          | **required** |

Computed fields are derived on read and never stored (§7.3):

```text
Model A   Expected Monthly Return = Initial Investment × Promised Return % ÷ 12
          Expected Total Return   = Initial Investment × (1 + Promised Return %)

Model B   Expected Monthly Return = Initial Investment × Monthly Return %
          Promised Return %       = Monthly Return % × 12
          Expected Total Return   = Initial Investment + (Expected Monthly Return × Term)

Model E   Expected Total Return   = Initial Investment + (Expected Monthly Return × Term)
```

## Models C and D have no expected return

Profit share and revenue share depend on business performance that cannot be known in advance. Any expected figure would be invented.

These investments are therefore **excluded** from every expected-versus-actual surface, and display `N/A` rather than a number:

* §9 Expected Profit and Expected vs Actual
* §12 Chart 5 (Expected vs Actual Returns)
* §19 underperformance alerts
* §31 metric 7 (expected future profit)

They are never treated as expecting zero. Zero would make every profit distribution look like it infinitely exceeded expectations, and would quietly poison the portfolio-level expected totals.

Realized metrics — actual profit received, ROI, annualized return — apply normally to these investments.

---

# 9. Important Financial Metrics

The dashboard should calculate these automatically.

## Total Invested

Total capital sent into investments.

```text
Total Investment Transactions
```

---

## Total Money Received

All money received from investments.

Includes:

* Profit
* Principal repayment
* Other distributions

---

## Total Profit Received

```text
Profit Received
```

Should exclude principal returned.

---

## Capital Outstanding

Capital still at risk.

```text
Total Capital Invested
− Principal Returned
− Capital Written Off
```

Write-offs are essential here. Without them, a defaulted business keeps reporting its capital as live forever, and the dashboard overstates the portfolio indefinitely.

---

## Capital Written Off

```text
Sum of Loss transactions
```

Marking an investment `Defaulted` is a **label, not a calculation**. Capital only leaves the outstanding figure when an explicit `Loss` transaction records it. This keeps the write-off dated, auditable, and reversible by adjustment like every other movement of money.

Defaulted investments remain in all portfolio totals. Excluding them would quietly inflate portfolio ROI by hiding the losses from the denominator — survivorship bias against yourself.

---

## Realized Profit

```text
Profit Received
− Fees Paid
− Capital Written Off
```

Fees reduce profit and never touch capital. Write-offs are real losses and must reduce profit, which means **realized profit and ROI can both be negative**. The dashboard must render negative values correctly rather than clamping at zero.

---

## Net Cash Flow

```text
Total Money Received
− Total Money Invested
```

Displayed outflow-negative: a month of net deployment shows as `-৳115,000`.

---

## Realized ROI

```text
Realized Profit / Total Capital Invested × 100
```

The dashboard labels this **Realized ROI**.

`Total Capital Invested` means **cumulative gross capital deployed** — every `Investment` transaction ever recorded. Capital that is returned and then redeployed therefore counts twice.

This is a deliberate choice, and it understates ROI when capital is recycled: ৳500,000 invested, returned, and reinvested reads as ৳1,000,000 deployed even though only ৳500,000 was ever at risk. The alternative — tracking average or peak capital at risk over time — is more accurate but far harder to explain and to audit against the transaction list. The KPI is labelled "on total capital deployed" on the dashboard so the meaning is visible rather than assumed.

---

## Unrealized P&L

```text
Latest Estimated Value (§7.6)
− Capital Outstanding
```

Only for investments carrying a valuation. Investments without one contribute nothing.

**Unrealized gains are never mixed into headline ROI.** Valuations are self-reported estimates, frequently optimistic, and folding them into the primary return figure is how a tracker starts flattering its owner. It is displayed as its own clearly separated figure.

---

## Expected Profit

```text
Expected Total Return
− Initial Investment
```

---

## Expected vs Actual

For every investment:

```text
Expected Return
Actual Return
Variance
```

Example:

```text
Expected: ৳100,000
Actual:   ৳72,000

Shortfall: ৳28,000
```

Investments on Models C and D show `N/A` here, never zero (§8).

---

## Precision and rounding

Values are stored and computed at **full precision**. Rounding happens only at the display layer:

| Value       | Display          |
| ----------- | ---------------- |
| Amounts     | 0 decimal places |
| Percentages | 1 decimal place  |

Intermediate values in the calculation layer are never rounded. Rounding mid-calculation and then summing across hundreds of transactions accumulates visible drift, and in a financial tracker a total that does not match its own line items destroys trust in every other number on the page.

---

# 10. Annualized Return

For investments held for different periods, simple ROI is not enough.

The system should calculate an annualized return where enough transaction history exists.

For example:

```text
Investment A
৳500,000 → ৳600,000
Held for 12 months

Annualized return ≈ 20%
```

If the investment lasted 6 months:

```text
৳500,000 → ৳550,000

Annualized return ≈ 21%
```

The dashboard should therefore show both:

* ROI
* Annualized ROI

This is especially important because the user may have:

```text
Investment A → 25% in 1 year
Investment B → 10% in 3 months
Investment C → 30% over 2 years
```

Comparing simple ROI alone would be misleading.

## Which method applies

"Where appropriate" is not implementable, so the selection is explicit:

| Condition                                                                 | Method    |
| ------------------------------------------------------------------------- | --------- |
| At least 2 cash flows, mixed signs, spanning ≥ 30 days                    | **XIRR**  |
| Otherwise, if the investment has a start date and any return              | **CAGR**  |
| Otherwise (too new, no returns yet, or XIRR fails to converge)            | `—`       |

CAGR is the plain compound form:

```text
(Total Received ÷ Capital Invested) ^ (12 ÷ months held) − 1
```

A dash is shown rather than a misleading number. An investment three weeks old has no meaningful annualized return, and displaying one invites decisions based on noise.

## Open positions need a terminal value

Realized cash flows alone are not enough. An investment that has paid returns but not yet repaid principal has, in pure cash-flow terms, not returned its capital — so IRR reports a catastrophic loss on every healthy investment that simply has not matured.

Annualized return therefore includes a final cash flow equal to **capital outstanding, valued at par** on the as-of date.

Par is an assumption, and a deliberately conservative one: it never claims a gain that has not been received, and it uses book value rather than a self-reported valuation, so §9's rule about keeping unrealized gains out of headline figures still holds. Capital written off is already excluded — outstanding falls to zero on a default, so a defaulted investment correctly annualizes to a loss.

## Implementation note

**Apps Script has no built-in XIRR.** Google Sheets' `XIRR()` formula is not available to Apps Script code, so it must be written by hand:

* Newton-Raphson on the NPV function, seeded at 0.1
* Bisection fallback when the derivative approaches zero or the iterate diverges
* Hard iteration cap (100), returning `null` on failure rather than a wrong rate
* Rates clamped to a sane search band; private-investment cash flows can produce mathematically valid but nonsensical roots

Returning `null` and displaying `—` is always preferable to displaying an unconverged number.

---

# 11. Portfolio Dashboard

The main dashboard should be the primary interface.

## KPI Cards

Top section:

```text
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Invested │ │ Total Received │ │ Profit Earned  │
│ ৳2,500,000     │ │ ৳750,000       │ │ ৳250,000       │
└────────────────┘ └────────────────┘ └────────────────┘

┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Capital        │ │ Realized ROI   │ │ Annualized ROI │
│ Outstanding    │ │                │ │                │
│ ৳2,000,000     │ │ 10.0%          │ │ 18.2%          │
└────────────────┘ └────────────────┘ └────────────────┘
```

Realized ROI is labelled **on total capital deployed**, per §9.

**Phasing:** Annualized ROI depends on the XIRR work scheduled for Phase 2 (§30). Phase 1 therefore ships five cards, and the sixth appears when annualized return lands.

---

# 12. Dashboard Charts

## Chart 1 — Portfolio Value Over Time

Line chart showing:

```text
Month → Total capital invested
```

Potentially show:

* Invested capital
* Returned capital
* Estimated current value

---

## Chart 2 — Monthly Cash Flow

Bar chart:

```text
Month
Investment outflow
Investment income
```

Example:

```text
Jan   -৳500k | +৳0
Feb   -৳200k | +৳15k
Mar   -৳0    | +৳25k
Apr   -৳100k | +৳30k
```

---

## Chart 3 — Investment Allocation

Pie/donut chart:

```text
Restaurant     35%
Retail         25%
Trading        20%
Real Estate    10%
Other          10%
```

Grouped by **Industry**, weighted by **Capital Outstanding**.

Outstanding rather than gross invested, because §32 asks "where is my money" in the present tense. Capital already returned is no longer allocated anywhere, and including it describes a portfolio that no longer exists.

---

## Chart 4 — Returns by Investment

Bar chart of **annualized** return (§10), not simple ROI:

```text
Business A   24%
Business B   18%
Business C   11%
Business D    5%
```

Simple ROI here would commit precisely the error §10 warns about — ranking investments with different holding periods against each other on a measure that ignores time. Investments with no annualized figure yet are omitted from the ranking rather than shown as zero.

---

## Chart 5 — Expected vs Actual Returns

Grouped bar chart:

```text
Business A   Expected 25% | Actual 22%
Business B   Expected 20% | Actual 27%
Business C   Expected 24% | Actual 12%
```

Profit-share and revenue-share investments are excluded from this chart entirely (§8), rather than plotted against a fabricated expectation.

---

## Chart 6 — Monthly Profit

Line chart showing actual investment income over time.

---

# 13. Investment Table

Dashboard should contain a sortable table.

Columns:

| Investment | Invested | Received | Profit | Outstanding | ROI | Annualized ROI | Status |
| ---------- | -------: | -------: | -----: | ----------: | --: | -------------: | ------ |
| Business A |    ৳500k |    ৳100k |   ৳50k |       ৳450k | 10% |            20% | Active |
| Business B |    ৳300k |     ৳90k |   ৳90k |       ৳300k | 30% |            35% | Active |
| Business C |    ৳200k |     ৳20k |   ৳20k |       ৳200k | 10% |             8% | Risk   |

Features:

* Sort
* Search
* Status filter
* Business filter
* Return model filter — Fixed / Monthly / Profit Share / Revenue Share / Custom
* Risk filter

The return filter selects by **return model**, matching §18. It does not filter by ROI range.

---

# 14. Investment Detail Page

Clicking an investment opens a detailed page.

## Header

```text
ABC Restaurant
Investment #INV-001

৳500,000 invested
20% expected annual return
Active
```

## Summary

```text
Initial Investment     ৳500,000
Principal Returned     ৳100,000
Profit Received         ৳50,000
Total Received         ৳150,000
Capital Outstanding    ৳400,000
Realized ROI             10%
Expected ROI             20%
```

## Cash Flow Timeline

```text
Jan 10
↓
Invested ৳500,000

Feb 10
↓
Received ৳8,000 profit

Mar 10
↓
Received ৳9,000 profit

Apr 10
↓
Received ৳10,000 profit
```

## Expected Payments

```text
✓ Feb 10   ৳8,000
✓ Mar 10   ৳8,000
⚠ Apr 10   ৳8,000
○ May 10   ৳8,000
```

---

# 15. Add Investment Flow

The HTML application should provide a form:

### Step 1 — Select business

```text
Business
[ ABC Restaurant ▼ ]
```

### Step 2 — Investment details

```text
Investment amount
৳ [500000]

Investment date
[2026-08-01]

Return model
[Monthly Fixed Return ▼]

Expected return
[2%]

Term
[12 months]
```

### Step 3 — Review

Show:

```text
Initial investment: ৳500,000
Expected monthly return: ৳10,000
Expected annual return: ৳120,000
Expected total profit: ৳120,000
```

Then:

```text
[Cancel] [Save Investment]
```

---

# 16. Add Transaction Flow

Simple transaction form.

```text
Investment
[ABC Restaurant]

Date
[2026-08-17]

Transaction Type
[Profit Received]

Amount
[৳10,000]

Payment Method
[Bank]

Reference
[TXN-12345]

Notes
[July profit]
```

Save.

Where the investment has open expected payments, the form also offers them so the user can confirm which one this transaction settles (§7.5). Matching is optional — a transaction may stand alone.

Apps Script then, **inside a single script lock** (§36):

1. Validates input.
2. Allocates the Transaction ID from the Settings counter.
3. Writes to the Transactions sheet.
4. Links any matched expected payment and recalculates its Settlement.
5. Writes the AuditLog entry.
6. Invalidates the dashboard cache.

Metrics are not recalculated here — they are computed on read (§26). The next dashboard load recomputes from the transaction history automatically.

---

# 17. Business Detail Page

Each business should have its own page.

Example:

```text
ABC Restaurant

Status: Active
Risk: Medium

Total invested:       ৳800,000
Total received:       ৳180,000
Profit received:      ৳120,000
Capital outstanding:  ৳740,000
ROI:                  15%
```

### Business information

* Owner
* Location
* Industry
* Start date
* Description
* Contact

### Investments

List all investments in the business.

### Transactions

Show complete transaction history.

### Notes

Show business updates and risks.

---

# 18. Portfolio Filters

Dashboard should support:

### Date

* All time
* This year
* Last 12 months
* Custom range

Date filters apply to **transaction dates**, not investment start dates. "Last 12 months" therefore means money that moved in the last 12 months, including movement on investments opened years earlier.

### Status

* Active
* Matured
* Exited
* Defaulted

### Business

Select one or multiple businesses.

### Return type

* Fixed
* Monthly
* Profit share
* Revenue share

### Risk

* Low
* Medium
* High

---

# 19. Alerts

The system should highlight important issues.

## Late payment

Example:

```text
⚠ ABC Restaurant
Payment of ৳15,000 is 12 days overdue.
```

## Underperforming investment

Example:

```text
⚠ XYZ Trading

Expected return: 20%
Actual annualized return: 11%

Performance is below expectation.
```

## Concentration risk

Example:

```text
⚠ 42% of portfolio capital is invested in ABC Restaurant.
```

The threshold should be configurable.

## Upcoming payment

```text
Upcoming:

ABC Restaurant
৳15,000
Due in 3 days
```

---

## Thresholds

Every threshold lives in Settings (§7.8) and is editable without a code change.

| Alert            | Setting key               | Default | Fires when                                                     |
| ---------------- | ------------------------- | ------- | -------------------------------------------------------------- |
| Late payment     | `overdue_grace_days`      | 3       | Payment unsettled more than 3 days past Expected Date           |
| Underperforming  | `underperform_threshold`  | 0.80    | Actual annualized return below 80% of expected                  |
| Concentration    | `concentration_threshold` | 0.30    | One business holds more than 30% of capital outstanding         |
| Upcoming payment | `upcoming_window_days`    | 7       | Payment due within 7 days                                       |

Underperformance alerts require an expected return, so they never fire for profit-share or revenue-share investments (§8). Concentration is measured on **capital outstanding**, consistent with §12 Chart 3.

---

# 20. Monthly Investment Report

Apps Script should optionally generate a monthly summary.

Example:

```text
August 2026 Investment Report

Total portfolio invested: ৳2,500,000

New investments:          ৳200,000
Principal returned:       ৳50,000
Profit received:           ৳35,000

Net investment cash flow: -৳115,000

Realized ROI: 12.4%
```

And:

```text
Best performer:
ABC Restaurant — 26.3%

Worst performer:
XYZ Trading — 7.2%

Upcoming payments:
3

Overdue payments:
1
```

Best and worst performer rank on **annualized return**, and only include investments held at least `performer_min_months` (default 3).

Without a minimum, a three-week-old investment that received one early payment annualizes to an absurd figure and permanently tops the chart — the ranking would surface noise rather than performance.

---

# 21. Data Validation

Apps Script must validate all inputs.

Examples:

## Hard rules — rejected

* Investment amount must be > 0.
* Transaction amount must be > 0 (amounts are always positive; §7.4).
* Investment must reference an existing business.
* Transaction must reference an existing investment.
* Dates must be valid and not in the future.
* IDs must be unique.
* Required fields cannot be empty.
* Fields marked blank for the chosen return model must be empty (§8).
* `Adjustment` transactions must reference an existing Transaction ID and carry an `Adjustment Effect`.
* Only `Adjustment` transactions may reference another transaction.

## Soft rules — warned, but permitted

| Rule                    | Bound (Settings)               | Default |
| ----------------------- | ------------------------------ | ------- |
| Annual return percentage | `max_annual_return_pct`       | 0–200%  |
| Monthly return percentage | `max_monthly_return_pct`     | 0–20%   |

These warn and require confirmation rather than blocking. Unusual private arrangements are exactly what this tracker exists to record, and a validator that refuses a real 300% deal is a validator the user will work around.

The HTML UI validates before submitting, but Apps Script revalidates every input regardless. Client-side validation is a convenience, never the enforcement point.

---

# 22. Auditability

Because this involves real money, every change must be traceable.

## Transactions are append-only

This is a hard constraint, not a preference. Apps Script exposes **no** function that updates or deletes a transaction row.

A transaction recorded as ৳50,000 that should have been ৳40,000 is not edited. Instead:

```text
TXN-00042   Profit      ৳50,000                                    (original, untouched)
TXN-00071   Adjustment  ৳10,000  Adjusts: TXN-00042  Effect: Decrease
```

The original stays exactly as recorded, and the correction carries its own date and reason. The history remains a record of what was believed at each point in time, which is what makes it auditable at all.

`voidTransaction(id, reason)` writes a full reversing entry for a transaction entered entirely in error. It never removes the row.

Businesses and Investments **may** be updated — they hold descriptive attributes rather than money movements. Every update is logged.

## AuditLog is Phase 1

The `AuditLog` sheet (§7.9) ships in Phase 1, not as a later addition.

An audit log added in Phase 4 contains no record of Phases 1 through 3 — precisely the period of early mistakes and schema churn that one would most want to inspect. Logging is cheap to build on day one and impossible to backfill.

---

# 23. Dashboard Navigation

HTML application navigation:

```text
Dashboard

Portfolio

Businesses
  ├── All Businesses
  └── Business Detail

Investments
  ├── All Investments
  └── Investment Detail

Transactions

Payments

Reports

Settings
```

---

# 24. UI Design

The interface should be simple and desktop-first.

### Design principles

* Clean financial dashboard.
* Minimal colors.
* Strong typography.
* Large KPI numbers.
* Tables for detailed data.
* Charts for trends.
* Modal forms for quick entry.
* Responsive enough for mobile.

Avoid building a complex SPA framework.

For this project:

```text
HTML
CSS
Vanilla JS
Apps Script
```

is sufficient.

---

# 25. Apps Script API Layer

The frontend should not directly manipulate Sheets.

Use Apps Script functions such as:

```javascript
getDashboardData()

getBusinesses(filter)
getBusiness(id)
createBusiness(data)
updateBusiness(id, data)
archiveBusiness(id)

getInvestments(filter)
getInvestment(id)
createInvestment(data)
updateInvestment(id, data)
archiveInvestment(id)

getTransactions(filter)          // see pagination below
createTransaction(data)
voidTransaction(id, reason)      // writes a reversing entry; never deletes

getExpectedPayments(filter)
createExpectedPayment(data)
matchPayment(paymentId, transactionId)

createValuation(data)
getValuations(investmentId)

createNote(data)
getNotes(filter)

getPortfolioMetrics(filter)
getInvestmentMetrics(id)
getSettings()
updateSetting(key, value)
```

Apps Script acts as the application/service layer.

## No hard deletes

`archiveBusiness` and `archiveInvestment` set status only. Nothing that has money attached to it is ever removed, because deleting a business would orphan its transaction history and silently change every portfolio total that history feeds.

## Filtering and pagination

`getTransactions()` with no arguments would eventually return every row in the sheet across the Apps Script payload boundary. All list endpoints therefore take a filter object from the start:

```javascript
{
  businessId, investmentId,
  dateFrom, dateTo,
  type, status,
  limit,        // default 200
  offset
}
```

Retrofitting pagination through a UI that assumed full result sets is far more work than building it in on day one.

## Error contract

Every function returns an envelope. Failures never throw across the `google.script.run` boundary:

```javascript
{ ok: true,  data: ... }
{ ok: false, error: { code: "VALIDATION", message: "...", field: "amount" } }
```

Apps Script exception messages surface awkwardly and inconsistently through `withFailureHandler`, and a validation failure is an expected outcome rather than a crash. Codes: `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `LOCKED`, `INTERNAL`.

---

# 26. Calculations Layer

Keep financial calculations separate from UI code.

Example:

```text
calculateInvestmentMetrics(investmentId)

calculatePortfolioMetrics()

calculateROI()

calculateAnnualizedReturn()

calculateCapitalOutstanding()

calculateExpectedReturn()

calculateExpectedVsActual()

calculateMonthlyCashFlow()

calculateUnrealizedPnL()

calculateXIRR(cashFlows)
```

This makes the system easier to test and maintain.

## Metrics are computed on read, never stored

Every metric is a pure function of the transaction history. Nothing derived is written back to the sheets.

Materializing metrics into cells means every one of them can go stale, and a stale financial figure is worse than a slow one — it is wrong without looking wrong. Compute-on-read is correct by construction: there is exactly one path to any number, and it starts at the transactions.

## Caching

Speed comes from caching the *output*, not from storing derived values:

* `getDashboardData()` caches its assembled payload in `CacheService` (script cache, 6-hour TTL).
* Any mutation invalidates the cache key immediately, inside the same lock as the write (§36).
* A cache miss simply recomputes. The cache is never a source of truth, and losing it entirely costs one slow page load.

## Pure functions

The calculation layer reads no sheets and writes no state. It takes arrays of transactions and returns numbers.

This keeps every financial rule in this document directly testable without a spreadsheet — which matters, because these are the functions where a bug is expensive and silent.

---

# 27. Automated Jobs

Google Apps Script time-based triggers can run daily.

### Daily job

```text
updatePaymentTimeliness()
checkOverduePayments()
checkUpcomingPayments()
```

`refreshCalculatedMetrics()` is deliberately absent. Metrics are computed on read (§26), so there is nothing to refresh — only the payment `Timeliness` column advances with the calendar, and that is what the daily job updates.

### Monthly job

```text
generateMonthlyReport()
backupSpreadsheet()
```

Optional email notification:

```text
Investment Tracker — August Summary

Profit received: ৳35,000
Upcoming payments: ৳45,000
Overdue payments: ৳15,000
```

---

# 28. Important Accounting Rules

The system must distinguish between:

### Capital

Money originally invested.

### Principal return

Money received that represents the original capital.

### Profit

Money earned above the invested principal.

This distinction is critical.

Example:

```text
Invested:        ৳500,000

Received:
Principal:       ৳500,000
Profit:          ৳100,000

Total received:  ৳600,000
Actual profit:   ৳100,000
```

The dashboard should not report ৳600,000 as profit.

## Combined payments

A business often sends one transfer covering both principal and profit. Since each transaction carries exactly one `Type`, such a payment is recorded as **two transactions** on the same date.

```text
৳60,000 received  →  TXN-00088  Profit            ৳10,000
                     TXN-00089  Principal Return  ৳50,000
```

Where the sender does not specify the split, the default is **profit first**, up to the profit accrued to date, with the remainder treated as principal return. The assumption is written into the transaction Description so a later correction has something to correct.

This default is deliberately conservative in the direction that matters: it avoids reporting capital repayment as earnings.

## Loss and fee

Both are defined in §7.4 and reach the metrics in §9:

* **Fee** reduces realized profit. It never touches capital.
* **Loss** writes capital off — reducing both capital outstanding and realized profit.

Without an explicit `Loss` transaction, a defaulted investment's capital stays on the books forever. Status alone changes no number.

---

# 29. Example Investment Scenario

Suppose:

```text
ABC Business

Investment:
৳500,000

Promised return:
20% annually

Term:
12 months
```

Expected:

```text
Principal:       ৳500,000
Expected profit: ৳100,000
Expected total:  ৳600,000
```

During the year:

```text
Jan    Invest ৳500,000
Feb    Profit ৳8,000
Mar    Profit ৳8,000
Apr    Profit ৳8,000
May    Profit ৳8,000
Jun    Profit ৳8,000
Jul    Profit ৳8,000
Aug    Profit ৳8,000
Sep    Profit ৳8,000
Oct    Profit ৳8,000
Nov    Profit ৳8,000
Dec    Profit ৳8,000
Jan    Profit ৳8,000
Jan    Principal ৳500,000
```

The system should calculate:

```text
Total profit received = ৳96,000

Expected profit = ৳100,000

Performance = 96% of expected profit
```

And report the investment as:

```text
Expected ROI: 20%
Actual ROI:   19.2%
```

---

# 30. MVP Scope

The first version should NOT implement everything.

### Phase 1 — Core

* [ ] Businesses
* [ ] Investments
* [ ] Transactions (append-only)
* [ ] **Script locking and ID allocation** (§36)
* [ ] **AuditLog** (§7.9) — cannot be backfilled later
* [ ] **Loss and fee handling** (§28) — otherwise capital never leaves the books
* [ ] Settings sheet with thresholds
* [ ] Basic calculations
* [ ] Dashboard — five KPI cards
* [ ] Investment detail page
* [ ] Business detail page
* [ ] Basic charts
* [ ] Search/filter
* [ ] Google Sheets persistence
* [ ] **Locked-down deployment** (§37)

The three bolded additions are not features — they are constraints that become progressively more expensive to retrofit. Locking prevents corruption that only appears under real use; the audit log has no history if added later; and without write-offs the portfolio total is wrong from the first default onward.

### Phase 2 — Investment intelligence

* [ ] Expected payments and generation rules
* [ ] Payment matching
* [ ] Overdue payments
* [ ] Annualized/XIRR return → adds the sixth KPI card
* [ ] Expected vs actual performance
* [ ] Investment risk
* [ ] Portfolio concentration

### Phase 3 — Automation

* [ ] Daily Apps Script trigger
* [ ] Payment reminders
* [ ] Monthly reports
* [ ] Email notifications
* [ ] Monthly backup job (§38)

### Phase 4 — Advanced

* [ ] Valuations and unrealized P&L
* [ ] Document/contract links
* [ ] Investment notes
* [ ] Scenario analysis
* [ ] What-if projections

---

# 31. Most Important Dashboard Metrics

The final dashboard should prioritize these:

### Portfolio

1. Total capital invested
2. Current capital outstanding
3. Total profit received
4. Total money received
5. Realized ROI
6. Annualized portfolio return
7. Expected **remaining** profit — expected total minus profit already received, excluding Models C and D (§8)
8. Number of active investments

### Cash flow

9. Investment cash outflow this month
10. Profit received this month
11. Principal returned this month
12. Net investment cash flow

### Risk

13. Highest portfolio concentration
14. Number of overdue payments
15. Amount overdue
16. Number of high-risk investments

### Performance

17. Best investment
18. Worst investment
19. Expected vs actual return
20. Portfolio performance over time

---

# 32. Key Design Principle

The application should answer three questions immediately:

### 1. Where is my money?

```text
৳2.5M invested

ABC Business       ৳800k
XYZ Trading        ৳600k
Restaurant         ৳500k
Retail             ৳400k
Other              ৳200k
```

### 2. How is my money performing?

```text
Total profit:      ৳250k
Realized ROI:      10%
Annualized ROI:    18.2%
Expected profit:   ৳350k
```

### 3. What should I worry about?

```text
⚠ 1 overdue payment
⚠ 42% concentration in one business
⚠ 2 investments below expected return
```

That should be the core philosophy of the product.

---

# 33. Future Possibility

Because Google Sheets is the database, the system should keep the data model clean enough that it can later be migrated to PostgreSQL.

The conceptual model should therefore be:

```text
Business
   │
   ├── Investment
   │      │
   │      ├── Transactions
   │      ├── Expected Payments
   │      ├── Valuations
   │      └── Notes
   │
   └── Notes
```

This keeps the system simple now while avoiding a spreadsheet structure that becomes impossible to migrate later.

---

# 34. Recommended MVP Philosophy

Do **not** start by building a huge financial application.

Start with these four things working perfectly:

```text
Business
   ↓
Investment
   ↓
Transaction
   ↓
Dashboard
```

If those four pieces are correct, almost every other feature can be added later.

The single most important rule is:

> **Every movement of money must be represented by a transaction.**

Everything else — ROI, profit, outstanding capital, cash flow, charts, reports, and alerts — should be calculated from that transaction history rather than manually entered.

This makes the tracker trustworthy enough to use for real investment decisions.

---

# 35. Dates, Currency and Precision

## Timezone

Apps Script project timezone, spreadsheet timezone, and the user's timezone must all be **`Asia/Dhaka`**.

When these differ, a date-only financial record can shift by a day at midnight boundaries — a payment recorded on the 1st appearing in the previous month's report. The mismatch is invisible in testing and corrupts monthly reporting.

Dates are stored as ISO `yyyy-MM-dd` **strings**, not as Date objects. Apps Script silently converts Date objects across timezone boundaries when writing to and reading from Sheets; strings do not move.

## Currency

BDT only. This is an explicit MVP constraint, not an oversight.

Transactions carry no `Currency` field, and no FX handling exists anywhere in the system. Adding a second currency later requires a currency column on Transactions and a rate table — a known, deliberate limitation rather than a hidden one.

## Precision

Defined in §9: full precision in storage and calculation, rounding only at display.

---

# 36. Concurrency and ID Allocation

Google Sheets has **no transactions**. Two writes arriving close together can interleave, overwrite each other, or allocate the same ID twice.

This does not appear in single-user testing. It appears months later as a duplicated transaction ID or a lost record, in a dataset that is supposed to be authoritative.

## Locking

Every mutating function acquires a script lock:

```javascript
const lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) return { ok: false, error: { code: "LOCKED" } };
try {
  // validate → allocate ID → write row → write AuditLog → invalidate cache
} finally {
  lock.releaseLock();
}
```

ID allocation, the data write, the audit log entry, and cache invalidation all happen **inside the same lock**. Splitting them allows a write that never gets logged, or a log entry for a write that failed.

Read-only functions take no lock.

## ID format

Sequential with a type prefix, readable at a glance in the spreadsheet:

```text
BIZ-001
INV-001
TXN-00001
PAY-00001
```

Readability matters more than usual here, because the database is a spreadsheet that will occasionally be inspected by eye. A UUID is safer against collisions but unreadable in a cell, and the script lock already removes the collision risk.

Counters live in Settings (§7.8) and are read-incremented-written inside the lock. Counters are never reused, including after an archive.

---

# 37. Deployment and Security

This application holds a complete record of personal finances. The deployment settings are part of the specification, not an install-time detail.

## Web app deployment

```text
Execute as:      Me
Who has access:  Only myself
```

A single wrong dropdown at deploy time — "Anyone with the link" — publishes the entire portfolio to anyone who obtains the URL. This must be verified after **every** redeploy, because Apps Script does not always preserve the setting across new deployment versions.

## Attachments

`Attachment` and `Agreement Reference` point at Drive files containing contracts and payment evidence. These inherit Drive's own sharing, not the app's.

Every linked file must be restricted to the owner. "Anyone with the link" on a Drive attachment leaks the document regardless of how locked down the web app is.

## Scope

Single user. There is no sharing model, no roles, and no per-record permissions — consistent with the non-goals in §3. `Session.getActiveUser().getEmail()` supplies the AuditLog `User` field.

---

# 38. Scale, Performance and Backup

## Expected volume

Designed for a personal portfolio: on the order of **tens of businesses, low hundreds of investments, and low thousands of transactions** over the system's lifetime.

At that scale a full transaction scan per dashboard load is comfortably within limits. The design deliberately does not optimize beyond it.

## Apps Script limits

* Function execution caps at **6 minutes**
* `google.script.run` payloads must stay modest — hence pagination on all list endpoints (§25)

The dashboard payload is cached (§26). If a full recompute ever approaches the execution limit, the transaction volume has outgrown Sheets, and §33's migration path to PostgreSQL is the answer rather than further optimization.

## Backup

Sheets version history is not a backup policy. A monthly Apps Script job copies the spreadsheet to a dated file:

```text
Investment Tracker — Backup 2026-08
```

Backups are retained indefinitely; they are small and this is financial history.

**Restore procedure:** open the dated copy, verify the last transaction ID against the AuditLog, then re-point the script's spreadsheet ID at the restored file. This should be tested once, deliberately, rather than discovered during an actual loss.

---

# 39. Decision Log

The rules below were open questions in review. All are now specified in the sections referenced. Full reasoning is in `prd-review.md`.

| Decision | Resolution | Section |
| -------- | ---------- | ------- |
| Concurrency control | Script lock around every mutation; IDs allocated inside it | §36 |
| Default / write-off | Explicit `Loss` transaction writes capital off; status alone changes no number | §9, §28 |
| Fees | Reduce realized profit, never capital | §9, §28 |
| Payment ↔ transaction link | `Matched Transaction IDs` FK; actuals derived, not stored | §7.5 |
| Payment matching | Explicit user confirmation, never automatic guessing | §7.5 |
| Payment generation | On create, Models A/B/E only; matched rows never regenerated | §7.5 |
| Deployment scope | Execute as me, access only myself | §37 |
| ID format | Sequential with prefix, counters in Settings | §36 |
| KPI phasing | Phase 1 ships five cards, sixth with XIRR | §11, §30 |
| Derived fields | `Expected Total Return` and `Investment Start Date` computed on read | §7.2, §7.3 |
| Metric architecture | Compute on read, cache output, no `refreshCalculatedMetrics()` | §26, §27 |
| Auditability | Transactions append-only; AuditLog in Phase 1 | §7.9, §22 |
| Risk precedence | Investment overrides business | §7.2 |
| ROI denominator | Cumulative gross deployed, labelled on the dashboard | §9 |
| "Total Return" | Removed as a duplicate of Total Money Received | §9 |
| Valuations | Feed Unrealized P&L, excluded from headline ROI | §9 |
| Combined payments | Two transactions; profit-first default when unspecified | §28 |
| Return-model fields | Per-model required/computed/blank matrix | §8 |
| XIRR trigger | ≥2 mixed-sign flows over ≥30 days, else CAGR, else `—` | §10 |
| Open-position IRR | Capital outstanding added as a terminal flow at par | §10 |
| Models C/D | Excluded from expected-vs-actual surfaces; `N/A`, never zero | §8 |
| Rounding | Full precision stored, rounded at display only | §9 |
| Direction field | Derived from `Type`, removed from the sheet | §7.4 |
| Amount sign | Always positive | §7.4 |
| Adjustment direction | Explicit `Adjustment Effect` column, not a signed amount | §7.4 |
| Settings schema | Key/Value/Type/Description with documented defaults | §7.8 |
| Currency | BDT only, stated as an explicit constraint | §35 |
| Timezone | `Asia/Dhaka` everywhere; ISO date strings | §35 |
| Payment status | Split into Settlement and Timeliness | §7.5 |
| Alert thresholds | Settings-driven with documented defaults | §7.8, §19 |
| Return filter | Filters by return model | §13, §18 |
| Chart 3 | Industry, weighted by capital outstanding | §12 |
| Chart 4 | Annualized return | §12 |
| Validation bounds | Hard rules reject; return-percentage bounds warn only | §21 |
| API surface | Archive not delete, filters and pagination, error envelope | §25 |
| Scale ceiling | Low thousands of transactions; migrate rather than optimize past it | §38 |
| Backup | Monthly dated copy with a tested restore procedure | §38 |
| Expected future profit | Remaining, not total | §31 |
| Best/worst performer | Minimum 3-month holding period | §20 |
