# Accessibility

StellarSplit is audited against **WCAG 2.1 AA** using automated [axe-core](https://github.com/dequelabs/axe-core) scans wired into Playwright. This document describes the audit scope, how the automated gate works, what was fixed, and the exceptions that remain accepted.

For general coding DOs/DON'Ts used while fixing issues, see [accessibility-guide.md](./accessibility-guide.md).

## Scope

The audit covers the following routes:

| Route | Status |
| --- | --- |
| `/` | Audited |
| `/dashboard` | Audited |
| `/invoice/new` | Audited |
| `/invoice/[id]` | Audited |
| `/verify/[id]` | Audited |
| `/analytics` | Audited |
| `/subscriptions` | **N/A — route does not exist in this app** |

The rest of the app (`/groups`, `/payments`, `/recipients`, `/settings`, etc.) was **not** included in this pass; it was scoped to the routes above by explicit decision. A follow-up audit should extend the same test pattern (see below) to the remaining routes.

## Automated testing

- **Tooling**: `axe-core` + `@axe-core/playwright`, run via Playwright (`e2e/a11y.spec.ts`).
- **Rules**: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` tag sets.
- **Gate**: every test asserts zero axe violations with `impact` of `critical` or `serious`. `moderate`/`minor` findings are not currently gated on.
- **Run locally**:
  ```bash
  npx playwright test --grep @a11y
  ```
- **CI**: `.github/workflows/accessibility.yml` runs the same command on every PR to `main` (and on push to `main`), installing Chromium, Firefox, and WebKit so the gate covers all three engines. A failing run blocks merge.

In addition to the per-page axe scans, two targeted interaction tests cover keyboard operability: the mobile nav menu (`Navbar`) and full keyboard/label reachability of the `/invoice/new` form fields.

## What was fixed

The initial audit surfaced the following categories of critical/serious violations, all resolved in this change:

1. **Color contrast (`color-contrast`, serious)** — the most common finding, across nearly every page:
   - The sticky nav header used a translucent background (`bg-surface-900/80`) that let the page's light-mode background bleed through, dropping nav-link contrast below 4.5:1. Fixed by raising opacity to `/95`.
   - Several buttons set a solid brand-color background (`bg-indigo-600`, `bg-gray-700`, etc.) but never set a foreground color, so text inherited the ambient body color (near-black in light mode) — effectively invisible. Fixed by adding explicit `text-white` (or `text-gray-900` for the lighter `yellow-600`/`green-600` buttons, where white text itself failed contrast).
   - The first-run onboarding modal and several form labels/headings on `/invoice/new` and `/verify/[id]` used dark-mode-only muted tokens (e.g. `text-gray-300`, `text-gray-400`, `text-slate-500`) directly on the page's light-mode background. Fixed by adding light-mode-aware pairs (e.g. `text-gray-700 dark:text-gray-300`) or bumping to a lighter shade where the surrounding box is always-dark by design.
   - The homepage's `"Instantly."` headline highlight (`text-indigo-400`) fell just under the 3:1 large-text threshold on a white background. Fixed with `text-indigo-600 dark:text-indigo-400`.
2. **`aria-prohibited-attr` (serious)** — loading-skeleton components (`src/components/Skeleton.tsx`) applied `aria-label`/`aria-busy` to plain `<div>`s with no role, which isn't a valid ARIA attribute target. Fixed by adding `role="status"` to each skeleton wrapper.
3. **`document-title` / `html-has-lang` (serious)** — `/invoice/[id]` was crashing during dev-mode rendering because `opengraph-image.tsx`'s `generateImageMetadata` returned an object instead of the array shape Next.js expects, throwing before the root layout (and its `<title>`/`lang`) could render. Fixed by returning `[]` and removing the redundant, duplicate title/description logic (the correct per-invoice metadata already lives in `layout.tsx`'s `generateMetadata`).
4. **Duplicate heading** — `/invoice/new` rendered two `<h1>Create Invoice</h1>` elements back-to-back (not axe-flagged directly, but a real screen-reader/outline defect). Removed the duplicate.

## Known limitations / accepted exceptions

- **`/subscriptions` does not exist.** No route to test; revisit if/when the page is added.
- **Authenticated, data-populated states are not exercised by CI.** This repo has no seeded Stellar testnet fixture or mock wallet, so in CI (and in this sandbox) `/dashboard`, `/invoice/[id]`, `/verify/[id]`, and `/analytics` render their "no wallet connected" / "invoice not found" fallback states rather than their fully-populated authenticated states. Those fallback states are covered and pass. The dozens of components that only mount once a wallet is connected and an invoice successfully loads (e.g. `PayModal`, `VotingPanel`, `CoCreatorPanel`, `CommentSection`, tabs on the invoice detail page) have **not** been exercised by the automated suite and should be spot-checked manually (or with a seeded fixture in a future pass) before considering the whole authenticated experience AA-verified.
- **Browser coverage locally vs. CI.** A fresh dev sandbox may only have the Chromium Playwright browser installed. CI installs Chromium, Firefox, and WebKit via `npx playwright install --with-deps`, so the merge gate is multi-engine even when a local run (`npx playwright test --grep @a11y`) only exercises Chromium.
- **Moderate/minor axe findings are not gated on.** Only `critical`/`serious` impact violations fail the build, per the acceptance criteria. Any moderate/minor findings surfaced by axe during a run are not currently tracked separately.

## Extending the audit

To add a new page to the gate, add an entry to the `PAGES` array in `e2e/a11y.spec.ts` — the shared `runAxe()` helper and assertion are reused automatically. For flows that require user interaction (opening a modal, completing a multi-step form), follow the pattern in the two targeted tests at the bottom of that file: drive the interaction with Playwright, then call `runAxe(page)` and assert on `critical`/`serious` violations.
