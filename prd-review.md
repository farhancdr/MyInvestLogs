# PRD Review — Personal Investment Tracker

Audit of `prd.md` (1508 lines). Grouped by severity. Section refs match the PRD.

Verdict: structurally sound. The core decision — Business → Investment → Transaction, everything derived from transactions — is right and worth protecting. The gaps are in the **money rules** (default, loss, fee, payment allocation), **concurrency**, and **undefined thresholds**. Those must be closed before code, because they are the parts that silently produce wrong numbers.

---

## A. Arithmetic errors in the document

### A1. §29 — profit total does not match the payment schedule

The schedule lists profit payments Feb → Dec. That is **11 payments × ৳8,000 = ৳88,000**, not ৳96,000.

With 11 payments the stated figures are all wrong:

| Stated | Actual (11 payments) |
| ------ | -------------------- |
| Total profit ৳96,000 | ৳88,000 |
| Performance 96% | 88% |
| Actual ROI 19.2% | 17.6% |

Author intent was clearly 12 monthly payments (a 12-month term). **Fix applied in `prd.md`:** added the missing 12th profit payment so the ৳96,000 / 96% / 19.2% figures hold.

### A2. §17 — Capital Outstanding contradicts §9

```
Total invested:       ৳800,000
Total received:       ৳180,000
Profit received:      ৳120,000
Capital outstanding:  ৳700,000   ← wrong
```

Principal returned = 180,000 − 120,000 = **60,000**.
Per §9, Outstanding = 800,000 − 60,000 = **৳740,000**.

**Fix applied in `prd.md`:** 700,000 → 740,000.

*(Checked and confirmed correct: §11 KPI cards, §13 investment table, §14 detail summary, §20 monthly report, §32 breakdown, §8 Model A/B, §10 both annualized examples. Only the two above are wrong.)*

---

## B. Blocking gaps — resolve before writing code

### B1. No concurrency control (not mentioned anywhere)

Google Sheets has no transactions. Two near-simultaneous writes will interleave and lose data or duplicate IDs. Every mutating Apps Script function needs `LockService.getScriptLock()` with a timeout, and the ID counter must be read-and-incremented inside that lock.

This is invisible in single-user testing and shows up as corrupted financial records later.

### B2. No default / write-off rule

`Status = Defaulted` exists on both Businesses and Investments. `Type = Loss` exists on Transactions. **Neither has any defined effect on any metric in §9 or §31.**

Unanswered: when a business defaults with ৳400,000 outstanding —
- Does Capital Outstanding drop to zero, or stay at 400,000?
- Does the loss enter the ROI numerator (making ROI negative)?
- Does a defaulted investment stay in the portfolio ROI denominator?

For a real-money tracker this is the single most consequential missing rule. Without it the dashboard overstates the portfolio indefinitely.

**Recommendation:** require an explicit `Loss` transaction to write capital off. Outstanding = Invested − Principal Returned − Written Off. Realized profit = Profit Received − Fees − Written Off, so ROI can go negative. Defaulted investments stay in all portfolio totals — hiding them inflates ROI.

### B3. No fee rule

`Type = Fee` exists, consumed by nothing. Does a fee reduce profit, reduce principal returned, or sit outside the metrics? Affects every ROI figure.

**Recommendation:** fees are money out, netted against realized profit, never against capital.

### B4. Expected Payments has no link to Transactions

§7.5 stores `Actual Payment Date` and `Actual Amount` — duplicating data that already lives in the Transactions sheet, with **no `Transaction ID` foreign key**. Two sources of truth for the same money. They will diverge.

Also undefined: how a received transaction gets *matched* to an expected payment (automatic by date+investment? manual pick in the UI?). Without a rule, §19 overdue alerts fire on payments that were actually paid.

**Recommendation:** add `Transaction ID` FK; drop `Actual Amount`/`Actual Payment Date` and read them through the FK, or keep them strictly as a denormalized cache written only by the matcher.

### B5. Expected Payment generation is unspecified

§8 Model B says "the system should generate expected payment records." Nowhere states:
- **When** — on investment create, or by daily trigger?
- **How many** — `Investment Term` months? What if term is blank?
- **What happens on edit** — investment amount changes from 500k to 600k; are unpaid future rows regenerated? Are paid rows preserved?
- **Models C and D** — profit/revenue share have no computable expected amount. Generate nothing? Generate zero-amount placeholders on schedule?

### B6. Deployment scope / auth not stated

Real financial data in a web app, with no statement of the Apps Script deployment setting. It must be pinned in the PRD: **Execute as: Me. Who has access: Only myself.** A single wrong dropdown at deploy time makes the entire portfolio public to anyone with the URL.

Related and also missing: `Attachment` and `Agreement Reference` are Drive URLs — their sharing permissions are a separate exposure and should be stated as "restricted, never anyone-with-link."

### B7. ID generation scheme undefined

`Business ID`, `Investment ID`, `Transaction ID` are all "Unique ID" with no format. Sequential (`TXN-00042`) is readable but needs the lock in B1 and a counter location (Settings sheet? script properties?). UUID is safe but unreadable in a spreadsheet.

**Recommendation:** sequential with prefix, counter in Settings, allocated inside the script lock. Readability matters a lot when the DB is a spreadsheet you will eventually eyeball.

---

## C. Contradictions

### C1. §30 Phase 1 cannot render its own dashboard

Phase 1 includes "Dashboard." §11 defines the dashboard KPI cards as including **Annualized ROI**. But annualized/XIRR is listed in **Phase 2**.

Resolve: either move annualized return to Phase 1, or state that the Phase 1 dashboard ships with five KPI cards and adds the sixth in Phase 2.

### C2. Stored calculated fields vs "calculate everything from transactions"

§34 states the core rule: everything is derived from transaction history rather than manually entered. But §7.3 stores `Expected Total Return` (marked "Calculated") and §7.2 stores `Investment Start Date` (derivable from the earliest investment). Both go stale the moment the source changes.

Resolve: either drop them from the sheets and compute on read, or explicitly designate them a cache with a named function that is the only writer.

### C3. §27 `refreshCalculatedMetrics()` vs §26 calculation layer

§26 describes pure calculation functions called on demand. §27 schedules a daily job to "refresh calculated metrics," implying metrics are materialized somewhere. These are two different architectures and the PRD does not say which one wins, or where refreshed metrics are stored.

Resolve: pick compute-on-read (simpler, correct by construction) and use `CacheService` for speed, or pick materialized with a stated storage location and staleness policy. Compute-on-read is the right default at this data volume.

### C4. §22 auditability vs the API surface

§22 says historical transactions should not be silently modified — but never states the rule as a hard constraint, and §25 offers no `voidTransaction`. Meanwhile `AuditLog` is marked "Optional" and parked in Phase 4.

Resolve: state transactions are **append-only** (no update, no delete; corrections are `Adjustment` transactions referencing the original), add `voidTransaction(id, reason)` writing a reversing entry, and move `AuditLog` to Phase 1. An audit log added after the fact has no history in it, which defeats the purpose.

### C5. Risk Level exists on both Business and Investment

§7.2 and §7.3 both carry `Risk Level`. §18's risk filter and §31 metric 16 ("number of high-risk investments") don't say which one governs. Define precedence — investment-level overrides business-level, business-level is the default at creation.

---

## D. Financial-model gaps

### D1. ROI denominator is ambiguous under recycled capital

§9 defines Realized ROI = Profit Received / Capital Invested × 100.

If ৳500,000 is invested, fully returned, then reinvested, "Capital Invested" reads ৳1,000,000 while only ৳500,000 was ever at risk. ROI is understated by half. The same distortion hits the portfolio KPI in §11.

Define explicitly which one is meant — cumulative gross deployed (as literally written) or peak/average capital at risk — and label the KPI accordingly. Cumulative gross is defensible and much simpler; it just needs to be a stated choice rather than an accident.

### D2. "Total Return" is a misnomer and a duplicate

§9 defines Total Return = Profit Received + Principal Returned — which is exactly "Total Money Received," already defined two metrics earlier. In finance, "total return" normally means realized *plus* unrealized. Two names for one number, and the name means something else to anyone with a finance background.

Drop it, or redefine as Realized + Unrealized (see D3).

### D3. Valuations are an orphan table

§7.6 defines the Valuations sheet, and §12 Chart 1 mentions "estimated current value" — but **no metric in §9 or §31 consumes it**. Unrealized gain/loss is never defined.

Add: `Unrealized P&L = Latest Estimated Value − Capital Outstanding`, and state clearly that headline ROI is realized-only and excludes it. Mixing self-reported valuations into a headline return number is how a tracker starts lying to you.

### D4. No rule for splitting a combined payment

A business sends ৳50,000 and doesn't say how much is profit and how much is principal. Since `Type` is a single value per transaction, the user must decide. The PRD never says so.

State it: combined payments are entered as **two transactions**, and where the split is unknown the documented default applies (recommend: profit first up to the amount accrued, remainder principal — and record the assumption in Description).

### D5. Return-model field precedence undefined

Investments carry `Promised Return %`, `Monthly Return %`, and `Expected Monthly Return` simultaneously. For Model A (20% annual) vs Model B (2% monthly = 24% annual), which field is authoritative, which are derived, and what happens when they disagree? §15's form shows a single "Expected return [2%]" box that could map to either.

Define per return model which fields are required, which are computed, and which must be blank.

### D6. §10 "where appropriate" is not a spec

"Where appropriate, use an XIRR-style calculation" — the trigger condition is undefined. XIRR needs at least one negative and one positive cash flow, and fails to converge on some series.

Define: use XIRR when ≥2 cash flows spanning ≥30 days with mixed signs; otherwise fall back to CAGR; otherwise display "—". Also note Apps Script has **no built-in XIRR** — it needs a hand-written Newton-Raphson solver with a bisection fallback and an iteration cap.

### D7. Models C and D break several dashboard elements

Profit-share and revenue-share have no computable expected return — §8 says so itself. But §9 "Expected vs Actual", §12 Chart 5, §19 underperformance alerts, and §31 metric 7 "expected future profit" all assume an expected figure exists.

State that these investments are excluded from expected-vs-actual surfaces and render "N/A" rather than zero. Treating unknown as zero makes every profit-share investment look like it is beating expectations infinitely.

### D8. Rounding and precision unstated

BDT amounts and percentages accumulated across many transactions. State: store full precision, round only at display (amounts 0dp or 2dp, percentages 1dp), and never round intermediate values in the calculation layer.

---

## E. Schema issues

### E1. §7.4 `Type` and `Direction` can contradict each other

`Type = Investment` implies Money Out; `Type = Profit` implies Money In. Storing both invites rows where they disagree, and no validation rule in §21 catches it.

Derive `Direction` from `Type` in the calculation layer and drop it from the sheet, or keep it as a computed display column written only by Apps Script.

### E2. Amount sign convention undefined

Are amounts always positive with `Direction` carrying the sign, or signed? Every metric formula depends on this and none of them say. State: **always positive**, sign derived from Type.

### E3. §7.8 Settings has no schema

Every other sheet has a field table. Settings has a bulleted list of example contents. Specify the shape — recommend `Key | Value | Type | Description`, with all §19 alert thresholds living here (see F1).

### E4. Transactions has no Currency field

Investments carry `Currency`; Transactions do not. Fine while BDT-only — but state that explicitly as a constraint so it is a known limit rather than an oversight.

### E5. Timezone not specified

Apps Script project timezone, spreadsheet timezone, and the user's timezone can all differ, which shifts date-only financial records by a day at boundaries. Pin all three to `Asia/Dhaka` and store dates as ISO `yyyy-MM-dd` strings rather than Date objects.

---

## F. Underspecified behavior

### F1. §19 alert thresholds are undefined

Only concentration is described as "configurable," with no default. Undefined: how many days late before overdue fires, what grace period applies, how far below expected counts as underperforming, how many days ahead "upcoming" looks.

All four belong in Settings with stated defaults. Suggested: overdue after 3 days, underperforming below 80% of expected annualized, upcoming within 7 days, concentration warning above 30%.

### F2. §13 "Return filter" is undefined

Listed as a filter with no meaning — filter by return *model*, or by ROI range? §18 lists "Return type," which suggests model. Reconcile the two lists.

### F3. §12 Chart 3 dimension is undefined

"Investment Allocation" shows categories that look like `Industry`, but §7.2 has both `Business Type` and `Industry`. And allocation by **gross invested** vs **capital outstanding** are materially different pictures — outstanding is the one that answers "where is my money *now*," which §32 says is the point.

### F4. §12 Chart 4 metric is undefined

"Returns by Investment" shows percentages without saying realized or annualized. Given §10's argument that comparing simple ROI across different holding periods is misleading, this chart should be annualized — otherwise it commits the exact error §10 warns about.

### F5. §21 "reasonable ranges" is not a validation rule

Needs numbers. Suggested: annual return 0–200%, monthly return 0–20%, with anything above the bound warned-but-permitted rather than blocked — unusual private deals are the whole point of this tracker.

### F6. §25 API surface is incomplete

Missing: `deleteBusiness` / `deleteInvestment` (or a stated soft-delete-only policy), `createValuation`, `createNote`, `createExpectedPayment`, `voidTransaction`.

`getTransactions()` takes no filter or pagination arguments. It will eventually return every row in the sheet across the Apps Script payload boundary. Add filter parameters from the start — retrofitting pagination through a UI is far more work than building it in.

No error contract is defined either: how a validation failure travels back to the frontend (thrown exception vs `{ok:false, error}` envelope). Pick the envelope — Apps Script exception messages surface awkwardly in `withFailureHandler`.

### F7. No stated scale ceiling or performance strategy

`getDashboardData()` recomputing every metric from a full transaction scan on each load has a ceiling, and Apps Script caps execution at 6 minutes. State the expected volume (hundreds of transactions? thousands?) and the caching approach — `CacheService` on the dashboard payload with invalidation on write is the natural fit.

### F8. No backup or recovery policy

Sheets version history exists, but for financial records the PRD should state the policy explicitly — recommend a scheduled monthly copy to a dated backup file via Apps Script, plus a stated restore procedure.

---

## G. Smaller notes

- **§9 Net Cash Flow** — display sign convention should be stated (§20 renders negative net flow as `-৳115,000`, i.e. outflow-negative).
- **§7.7 Investment Notes** — `Investment ID` is optional, so a note can attach to business or investment. Worth stating that business-level notes are the fallback so the UI knows where to render them.
- **§7.5 Status** — `Partial` and `Late` are not mutually exclusive; a payment can be both. Either split into two fields (settlement state + timeliness) or define explicit precedence.
- **§18 date filters** — "This year" and "Last 12 months" need to state whether they filter transaction dates or investment start dates. Different answers.
- **§31 metric 7 "Expected future profit"** — undefined whether this is total expected profit or expected profit *remaining* (total minus already received). Remaining is the useful one.
- **§20 monthly report** — "Best/worst performer" needs a minimum holding period, or a one-month-old investment with a single lucky payment tops the chart on annualized return.

---

## H. What the PRD gets right

Worth stating, because these are the decisions that are expensive to reverse later and this document got them correct:

- **Separating Business / Investment / Transaction.** The §6 rationale is exactly right, and the §33 hierarchy migrates cleanly to PostgreSQL.
- **§34's rule** — every movement of money is a transaction, everything else is derived. This is the correct architecture and the whole design should be defended against convenience shortcuts that violate it.
- **§28's capital / principal / profit distinction**, with the explicit warning not to report ৳600,000 as profit. This is the mistake most homemade trackers make.
- **§10's argument** that simple ROI across different holding periods is misleading. Correct, and correctly motivated by the three-investment example.
- **Phased MVP scope** with an explicitly small Phase 1.
- **Keeping the frontend off the Sheets API** (§25) — the right call for both validation and future migration.

---

## Recommended next step

Resolve **B1–B7** and **C1–C5** first. They are decisions, not code — an hour of choices that prevents rewriting the calculation layer later. **D1–D8** can be answered while writing the calculation layer, as long as each answer lands in the PRD rather than only in code.

Open decisions are tracked in `prd.md` §35.
