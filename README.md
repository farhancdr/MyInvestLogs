# Personal Investment Tracker

A private tracker for investments in small businesses, private ventures and partnerships. Implements `prd.md`, Phase 1 scope (§30).

React + Vite frontend, Hono API, SQLite. Runs locally in Docker. Not deployed anywhere.

---

## Run it

```bash
docker compose up --build
```

Then open **http://localhost:3000**.

The database lives at `data/tracker.db` and is mounted into the container, so your records survive rebuilds.

### On a new machine

```bash
git clone <your-private-repo>
cd personal-invest-tracker
docker compose up --build
```

The database is committed, so cloning restores every record. Nothing else to restore.

---

## Development

```bash
npm install
npm run dev       # Vite on :5173, API on :3000
npm test          # calculation-layer tests
npm run typecheck
```

`npm install` may need its native build approved:

```bash
npm install-scripts approve better-sqlite3 esbuild
```

### Sample data

To see how a populated dashboard looks before entering anything real:

```bash
npm run seed        # 5 businesses, 7 investments, 51 transactions
npm run seed:clear  # remove them
```

Every seeded row carries a visible `[sample]` marker, and cleanup deletes only marked rows — real records entered alongside are never at risk. The sample set deliberately covers all five return models, a short payment, a fee, a defaulted business written off, and one corrected transaction.

### Snapshots

```bash
npm run dump   # writes data/dump.sql
```

The `.db` file is what gets committed, but a binary blob has no readable history. Run this before anything risky so git holds a text copy you can diff.

**One caveat on committing the database:** it conflicts unresolvably if you ever commit from two machines. One machine at a time is fine.

---

## Layout

```
src/
  shared/        types, constants, and calc.ts — every financial rule
  server/
    db/          SQLite connection + SQL migrations
    services/    ids, audit, dates, validation, repo, metrics
    routes/      HTTP API
  client/
    lib/         fetch wrapper, hash router, formatting
    components/  charts, tables, forms, primitives
    pages/       dashboard, businesses, investments, transactions

test/            calculation-layer tests
scripts/         seed and dump
legacy/          the previous Google Apps Script implementation
```

### Where the rules live

Every financial rule is in `src/shared/calc.ts` and nowhere else. The server feeds it rows, the client formats what comes back. If a number looks wrong, that file and its tests are the whole search space.

---

## How the data behaves

**Every movement of money is a transaction** (§34). Creating an investment automatically writes its opening `Investment` transaction — initial capital is not a special case.

**Transactions are append-only**, enforced by a database trigger rather than by convention. There is no update and no delete. To correct one, use Void: it writes a reversing `Adjustment` and leaves the original row exactly as recorded.

**A defaulted investment does not write itself off.** Setting status to `Defaulted` changes no number. Capital leaves the outstanding total only when you record a `Loss` transaction, which also reduces realized profit and can push ROI negative.

**Fees reduce profit, never capital.**

**Realized ROI counts recycled capital twice.** Capital invested, returned, then redeployed reads as double the gross deployed — the documented choice in §9, which is why the tile is labelled "on total capital deployed".

**Profit-share and revenue-share investments show N/A**, never zero, wherever an expected return would be required (§8). Their actual returns are tracked normally.

**Annualized return values open positions at par** (§10). Without a terminal cash flow, IRR treats un-returned capital as a total loss and reports a catastrophic figure for every healthy investment that has not yet matured.

---

## What Phase 1 covers

| PRD | Built |
| --- | ----- |
| §7 | Full schema; sheets became tables one-to-one, per §33 |
| §9 | Totals, ROI, fees, write-offs, outstanding capital, net cash flow |
| §11 | Dashboard with five KPI tiles |
| §12 | Portfolio over time, cash flow, allocation by industry, monthly profit |
| §13 | Sortable, searchable, filterable investment table |
| §14 | Investment detail: summary, terms, expected vs actual, timeline |
| §15 | Add-investment flow with live expected-return review |
| §16 | Add-transaction flow with per-type accounting hints |
| §17 | Business detail with rolled-up metrics and full history |
| §21 | Hard rules reject; return-percentage bounds warn only |
| §22 | Append-only transactions, void-by-reversal, audit log |
| §25 | Filters, pagination, `{ ok, data | error }` envelope |
| §26 | Pure calculation layer, computed on read |
| §35 | ISO dates pinned to `Asia/Dhaka` |
| §36 | SQL transactions and sequential ID allocation |

### Deliberately not in Phase 1

Per §30 these belong to later phases. The tables exist so no migration is needed later; nothing writes to them yet.

- **Expected payments and matching** (Phase 2)
- **Annualized ROI as the sixth KPI tile** (Phase 2) — computed and returned by the API, no screen shows it
- **Charts 4 and 5** (Phase 2) — both need cross-investment annualized or expected-vs-actual data
- **Alerts and concentration warnings** (Phase 2) — `calcConcentration` is built and tested, unused by the UI
- **Valuations, notes, scenario analysis** (Phase 4) — `calcUnrealizedPnL` is built and tested, unused

---

## Charts

Colors come from a palette validated for both light and dark surfaces: lightness band, chroma floor, colorblind separation, and normal-vision separation all pass in both modes. Three light-mode slots fall below 3:1 contrast against the surface, so the allocation chart carries visible value labels and the investment table doubles as the table view.

Series slots are assigned in fixed order and never cycled — a ninth industry folds into "Other" rather than inventing a hue.

Cash flow is drawn as polarity — money in above the baseline, money out below — rather than as two unrelated categories. Allocation is a stacked bar rather than a donut, because shares are far easier to compare along a common baseline.

---

## Security

No authentication, by design. The app binds to `127.0.0.1` only and is single-user (§3). Do not expose the port beyond this machine, and keep the repository private — it contains your complete financial history.
