# Refactor Plan: breaking up App.jsx

## Why

`src/App.jsx` is ~19,700 lines / 1.46MB — one file holding every tab, every modal,
every helper function, and 150+ `useState` hooks in a single component. It works,
and after recent fixes (see git log) the runtime performance is fine. The problem
is maintainability: every change risks touching unrelated code, and there is
**no automated test coverage** for financial logic (donation totals, receipt
numbers, tax-year calculations) — so today, a human reading the diff is the only
thing that catches a regression.

This plan restructures the app into a normal multi-file React app, in phases
small enough to review, without a big-bang rewrite. **The app must build and work
after every single commit.** No phase is "in progress" across a commit boundary.

## Current stack (confirmed)

- Vite + React 19, plain JS (no TypeScript)
- No router — tab switching is a `activeTab` state string
- No state management library — all state lives in `App()`'s hooks
- No test runner — no vitest/jest/playwright installed
- Styling is 100% inline `style={{...}}` objects, driven by two objects already
  defined in `App.jsx`: `C` (color palette) and `s` (a shared style dictionary)
- ESLint is configured (`eslint.config.js`) but no CI runs it automatically

## Guiding principles

1. **Strangler fig, not a rewrite.** Each phase extracts one thing at a time out
   of `App.jsx` into its own file, while `App.jsx` keeps importing and using it.
   The app is shippable after every commit.
2. **Tests before restructuring the risky parts.** Business logic (money,
   receipts, tax years) gets unit tests before it moves, so a move can be
   verified mechanically, not just by eye.
3. **Pure logic moves before components.** Functions with no JSX and no React
   state are the lowest-risk, highest-value things to extract first.
4. **One phase, one PR-sized commit (or a few).** Never bundle two phases in one
   commit — makes `git bisect` useless if something breaks later.

## Phases

### Phase 0 — Safety net (do this first) — ✅ started
- [x] Added `vitest` + `jsdom` as dev dependencies, `npm test` / `npm run test:watch` scripts.
- [x] Added `.github/workflows/ci.yml` — runs lint (non-blocking, see note below),
  test, and build on every push/PR to `main`.
- [x] Exported the pure, non-JSX helpers that were previously unexported
  module-scope functions in `App.jsx` (`donationDonorKey`, `contactDonorKey`,
  `isoWeekKey` — hoisted out of `App()`, it had no closure dependency,
  `fiscalYearOf`, `fiscalYearBounds`, `fillTemplate`, `colorForDonor`) so they
  can be imported by tests without waiting for Phase 1's file move.
- [x] `src/__tests__/pureHelpers.test.js` — 19 tests covering the functions
  above (donor-key precedence/fallback, ISO week edge cases against published
  reference dates, fiscal-year boundary math, template substitution, the
  deterministic donor-color hash).
- [ ] Tests still needed for donation totals/median/average, receipt-number
  generation, and tax-deduction eligibility — these currently live as closures
  inside `App()` (not pure top-level functions), so testing them requires
  either Phase 1's extraction first, or careful hoisting like `isoWeekKey` got.
- **Note:** `npm run lint` currently fails with 50 pre-existing errors / 22
  warnings unrelated to this plan (scattered unused variables etc.). Wired as
  non-blocking in CI for now so the pipeline isn't red from day one for
  unrelated reasons. Fixing that debt and flipping lint to blocking is a good
  small follow-up, separate from the phases below.
- **Risk:** none — purely additive/exports, touches no runtime behavior.
  Build and full test suite verified green after this phase.

### Phase 1 — Extract pure logic (no JSX) into `src/lib/` — ✅ done
- [x] `src/lib/donorKeys.js` — `donationDonorKey`, `contactDonorKey`
- [x] `src/lib/fiscalYear.js` — `fiscalYearOf`, `fiscalYearBounds`, `isoWeekKey`
- [x] `src/lib/format.js` — `fillTemplate`
- [x] `src/lib/color.js` — `colorForDonor`
- [x] `src/lib/donationStats.js` — `computeDonationBadges` (first-gift/biggest-yet/
  loyal/major-donor badges, previously a `useMemo` closure) and
  `computeDonationSummaryStats` (receipts issued, unique donors, avg/median gift,
  previously another `useMemo` closure) — both now pure functions taking
  `donations` + options, tested in `donationStats.test.js` (12 tests: badge
  chronology, per-donor isolation, threshold edges, year-scoping).
- [x] `formatDate`/`formatNumber`/`formatCurrency` added to `src/lib/format.js`,
  covering all ~10 distinct `.toLocaleDateString('en-SG', {...})` option
  combinations found in `App.jsx` (126 call sites) plus the two shapes
  `.toLocaleString()` was used for — plain counts (`formatNumber`) vs dollar
  amounts (`formatCurrency`, 247 call sites total across both uses). 12 tests,
  including one asserting an unknown preset name throws rather than silently
  rendering "Invalid Date".
- **Deliberately not done:** migrating the 373 existing call sites in `App.jsx`
  to use these new helpers. There's no reliable mechanical way to do that
  safely at this scale — the expression before `.toLocaleDateString(...)`
  varies too much (nested calls, ternaries) for a safe regex rewrite without
  real AST tooling, and hand-editing 373 sites in one sitting is exactly the
  kind of large, hard-to-review diff this plan's guiding principles warn
  against, especially with no way to click-test the live app in this
  environment. **Decision (confirmed with the user): migrate call sites
  opportunistically as each tab is rebuilt in Phase 5, not as a separate sweep.**
  The helpers exist and are tested now; adoption happens naturally as code is
  already being touched for structural reasons.
- Each extraction: move the function, `import` it back into `App.jsx`, add/keep
  tests against the new location, confirm `npm run build` still passes.
  All 43 tests pass (19 Phase 0 + 12 badges/stats + 12 formatters), build
  output unchanged in size (no existing call sites were touched).
- **Risk:** low — pure functions, all covered by tests before/after the move.

### Phase 2 — Extract the design system — ✅ done
- [x] `src/theme.js` — the `C` color palette + font-stack object
- [x] `src/styles.js` — the `s` shared style dictionary (imports `C` from theme.js)
- [x] `src/components/ui/InfoTip.jsx`, `EmptyState.jsx`, `ActionBanner.jsx`,
  `SenderIdentityLine.jsx` — already-standalone presentational components,
  relocated with their imports updated to pull `C` from `theme.js`.
- Verified: `npm test` (43/43 pass, untouched by this phase — no business logic
  moved), `npm run build` (836 modules, output size unchanged), and a live
  `npm run dev` boot with console-error check + full page-text read of the
  login screen, confirming every relocated piece resolves correctly at
  runtime, not just at build time.
- **Risk:** low — no logic changed, only file locations. `App.jsx` is down to
  20,426 lines (from ~20,665 at the start of this phase).

### Phase 3 — Extract modals — ✅ done
- [x] `src/components/modals/AddGrantModal.jsx`, `EditPledgeModal.jsx`,
  `RecurringGiftModal.jsx` — imported `C`/`s` from Phase 2's `theme.js`/`styles.js`
  (previously relied on same-file closure).
- [x] `src/components/panels/GrantLedgerPanel.jsx`, `CampaignExpensePanel.jsx` —
  these already received `s`/`C` as props from their callers, so no import
  changes were needed there, only relocation.
- These five all have real save/cancel/delete/edit behavior (unlike Phase 2's
  purely presentational pieces), so verification mattered more here: full test
  suite (43/43, none of these were exercised by existing tests — this phase
  added no new tests since there's no pure logic here to test, only JSX +
  local form state), production build (841 modules, output size unchanged),
  and a live dev-server boot + console-error check + full page-text read.
- **Live click-through (2026-07-20), done together with the user — they signed
  into their own account in the browser pane, I drove the clicks from there:**
  created, edited, and deleted a test grant (`AddGrantModal`); logged an
  expense against it (`GrantLedgerPanel`, budget % recalculated live); created
  a test pledge, edited its amount, and cancelled it, plus inspected the
  multi-year instalment view on a real 2-year pledge (`EditPledgeModal`);
  created a GIRO recurring gift, edited its amount, and cancelled it
  (`RecurringGiftModal`); logged and deleted an expense against the live
  campaign, ROI recalculated live (`CampaignExpensePanel`). All test data
  cleaned up afterward — account back to its original state. All 5 confirmed
  working with real saves against the live database, not just "app boots."
- **Risk:** low-medium in principle (real behavior, not just presentation),
  but the move was mechanical (function bodies unchanged, only import sources
  changed), so realized risk was low. `App.jsx` down to 19,622 lines (from
  20,426 at the start of this phase — removed ~800 lines of modal code).

### Phase 4 — Data layer: one hook per domain — ⏸ deferred (2026-07-20)
Original idea: replace the flat `useState`/`useMemo` soup in `App()` with custom
hooks that own their own fetch + local state + derived stats per domain
(`useDonations()`, `usePledges()`, `useRecurringGifts()`, etc.).

**Why deferred:** tried this on the smallest candidate domain, `refunds`, as a
first slice. `saveRefund()` directly writes into five *other* domains' state
(`setDonations`, `setPledges`, `setPledgeGivenTotals`, `setRecurringGifts`,
`setRecurringGivenTotals`) to unwind a refunded donation's pledge/recurring-gift
links. This cross-wiring is the norm, not the exception, across
donations/pledges/recurring gifts — there is no domain in this app that's
actually independent. A true "one hook per domain" split either (a) becomes
leaky — hooks taking other domains' setters as parameters, which doesn't
reduce coupling, just relocates it — or (b) requires a real shared data layer
(Context or a query cache) that mutations go through instead of calling
siblings' setters directly. Option (b) is a materially bigger, riskier change
than anything done in Phases 0-3, with no evidence yet that it's needed —
nothing is currently broken by the coupling, it's just not pretty.

**Decision:** skip this for now. Revisit only if Phase 5 reveals real pain
from passing shared state down as props (not just inelegance). Cross-domain
state (`donations`, `pledges`, `recurringGifts`, `refunds`, etc.) keeps living
at the top level and gets passed down as props to each tab's page component —
the pattern React apps used for years before hooks-per-domain. Less elegant,
but honest about what's safe to change today, and doesn't block Phase 5's
main win (breaking up the file).

### Phase 5 — Split each tab into its own page component — 🔄 in progress
- [x] **Reports** → `src/pages/ReportsPage.jsx` (2026-07-20). Turned out to be the
  smallest tab (~200 lines), not Settings (~2000 lines) as originally guessed —
  measured actual line counts between `activeTab ===` blocks before picking
  the starting tab, rather than trusting the file's declaration order.
  Genuinely self-contained: no local complex state, just reads a handful of
  values (`donations`, `charityName`, `grants`, `auditLog`, `filterYear`, ...)
  and calls PDF/CSV export functions that stay defined in `App()` and get
  passed down as props (per the Phase 4 deferral). Verified: 43/43 tests,
  build (842 modules, output size unchanged), and live click-through together
  with the user — navigated to the tab, confirmed all data renders correctly
  (FY breakdowns, totals matching pre-refactor), clicked an export button,
  confirmed no console errors.
- [x] **Grants** → `src/pages/GrantsPage.jsx` (2026-07-20). Larger than Reports —
  filters, sorting, an expandable grant-card renderer, and the `GrantLedgerPanel`
  integration — so more props to drill (~40), but still no local domain state of
  its own beyond UI toggles (search/filter/sort values, expanded-card id), all
  of which already lived in `App()` as `useState` and got passed straight
  through. Verified: 43/43 tests, build (843 modules), and a live click-through
  with the user — grant list rendered correctly, opened the ledger panel,
  logged a test expense (budget % updated live), deleted it (confirm dialog
  worked), cleaned up back to original state.
- [ ] Remaining, in ascending measured size: Mass Appeal (364),
  Recurring (518), Pledges (652), Donations (1040), Donors-detail (1104),
  Settings (~2000), Analytics/Dashboard (3159, biggest — do last).
As each tab's JSX is touched here, convert its `.toLocaleDateString('en-SG', {...})`
/ `.toLocaleString()` call sites to `formatDate`/`formatNumber`/`formatCurrency`
from `src/lib/format.js` (see Phase 1 note) — opportunistic, not a separate pass.
One tab at a time, in roughly ascending order of size/risk:
`Settings` → `Grants` → `MassAppeal` → `Recurring` → `Pledges` → `Reports` →
`Iras` → `Donations` → `Dashboard`(`Analytics`) → `Donors`.
Each becomes `src/pages/<Tab>Page.jsx`. Domain state (donations, pledges, etc.)
and their mutation functions stay owned by `App()` and get passed down as
props — see Phase 4's deferral note above. Each page also consumes the
Phase 2/3 shared components (`theme.js`, `styles.js`, `components/ui/`,
`components/modals/`, `components/panels/`). `App.jsx` shrinks to state +
data-fetching + layout + tab routing.
- **Risk:** medium-high per tab, but isolated — a bad split of `Grants` doesn't
  endanger `Donations`. This is the strangler-fig core of the whole plan.

### Phase 6 — Real routing (optional, do after Phase 5)
Swap the `activeTab` string for React Router, giving real URLs per tab
(shareable links, browser back/forward working correctly).
- **Risk:** low, purely additive once pages already exist as components.

### Phase 7 — Styling migration (opportunistic, folded into Phase 5)
As each tab is split out in Phase 5, migrate its inline `style={{}}` objects to
CSS Modules scoped to that page, rather than doing a separate blanket pass.
- **Risk:** low if done incrementally; high and pointless if attempted as one
  giant separate change.

### Phase 8 — TypeScript (optional, last, only if wanted)
Only worth doing after the file split (Phase 5) — migrating a 19,700-line
single file to TypeScript is much riskier than migrating 15 small page files
one at a time with `allowJs`/`checkJs` easing the transition.

## What we are *not* doing
- No big-bang rewrite. No phase touches more than one domain/tab at a time.
- No introducing a state management library (Redux/Zustand) unless Phase 4
  reveals prop-drilling pain that custom hooks + Context don't solve — decide
  that later, with evidence, not up front.
- No changing the Supabase schema or backend as part of this plan.

## Suggested starting point

Phase 0 (tests + CI) is the recommended first move — every later phase is
easier to verify safely once it exists. Phase 1 (pure logic extraction) is the
lowest-risk code-moving work and a good second step.
