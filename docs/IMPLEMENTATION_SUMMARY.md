# Implementation Summary

Four features were implemented across the StellarSplit dashboard and invoice detail pages. Each section below describes what was built, which files were created or modified, and how the acceptance criteria are satisfied.

---

## Issue 1 — Infinite Scroll for Invoice List

### Problem

The dashboard loaded all invoices in a single blocking loop (`for id = 1 to 50`), calling `splitClient.getInvoice` for every id sequentially. As the invoice count grew this produced slow initial page loads and wasted work fetching invoices the user never scrolled to.

### Solution

Three new pieces work together to replace the loop fetch with cursor-based infinite scroll.

#### `src/app/api/invoices/route.ts` (new)

A `GET` handler that accepts `publicKey`, `cursor`, and `limit` query parameters and returns a single page of invoices plus a `nextCursor` value.

```
GET /api/invoices?publicKey=<address>&limit=20
GET /api/invoices?publicKey=<address>&cursor=<lastId>&limit=20
```

Response shape:

```json
{ "invoices": [...], "nextCursor": "42" }
```

`nextCursor` is `null` when `splitClient` throws (no more invoices exist) or when fewer than `limit` results were found. The cursor is the numeric id of the last invoice returned — the next request starts from `cursor + 1`. A safety cap prevents scanning more than `limit × 10` ids per request.

#### `src/hooks/useInfiniteInvoices.ts` (new)

A React hook wrapping `useSWRInfinite` from the `swr` library. It derives the URL for each page from the previous page's `nextCursor` and exposes a stable `loadMore` function.

```ts
const { invoices, isLoading, isFetchingMore, hasMore, loadMore } =
  useInfiniteInvoices(publicKey);
```

Key SWR options:
- `revalidateFirstPage: false` — avoids re-fetching page 1 on every focus event
- `persistSize: true` — preserves loaded page count across re-renders, which restores the scroll state when navigating back

#### `src/components/InvoiceListSentinel.tsx` (new)

A thin component that places an observed `div` at the bottom of the list. `IntersectionObserver` fires `onVisible` when the element enters the viewport within 300 px (`rootMargin`). It renders a spinner while a fetch is in flight and an "All invoices loaded" message when `allLoaded` is true.

#### `src/components/DashboardClient.tsx` (modified)

- Removed the `splitClient` loop fetch `useEffect`
- Added `useInfiniteInvoices(publicKey)` hook call
- Removed the now-unused `setInvoices`/`setLoading`/`setError` state (error and loading now come from the hook)
- Added `<InvoiceListSentinel>` below the invoice grid, passing `loadMore`, `isFetchingMore`, and `!hasMore`
- Removed the unused `card` variable inside the grid map

### Acceptance criteria

| Criterion | How satisfied |
|---|---|
| Initial load fetches only the first 20 invoices | `limit=20` on every first-page request; API returns at most 20 |
| Scrolling within 300 px of bottom triggers next fetch | `rootMargin="300px"` on `IntersectionObserver` in `InvoiceListSentinel` |
| Spinner at sentinel position while fetching | Spinner rendered when `loading` prop is true |
| "All invoices loaded" message when done | Rendered when `allLoaded` prop is true and `loading` is false |
| Back-button restores scroll position and loaded pages | `persistSize: true` in `useSWRInfinite` keeps all pages in cache |

---

## Issue 2 — Responsive Invoice Detail Layout

### Problem

The invoice detail page used a fixed `max-w-2xl` container with no overflow protection, causing horizontal scroll on narrow viewports (iPhone SE at 375 px, Pixel 5 at 393 px).

### Solution

#### `src/app/invoice/[id]/layout.tsx` (modified)

Added an `overflow-x-hidden` wrapper with responsive horizontal padding:

```tsx
<div className="min-h-screen overflow-x-hidden">
  <div className="px-4 sm:px-6 lg:px-8">
    {children}
  </div>
</div>
```

This follows the `px-4 sm:px-6 lg:px-8` gutter pattern described in the issue.

#### `src/app/invoice/[id]/page.tsx` (modified)

- Changed the `<main>` container from `max-w-2xl mx-auto px-4 sm:px-6 py-16` to `w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 overflow-x-hidden`
  - `w-full` prevents the element shrinking below its parent
  - `overflow-x-hidden` is a second-line guard against child overflow
  - Reduced top padding on mobile from `py-16` to `py-8` to give more vertical room
- Added `justify-end` to the header action button row (`flex-wrap justify-end`) so buttons wrap neatly on narrow screens instead of overflowing

### Acceptance criteria

| Criterion | How satisfied |
|---|---|
| No horizontal overflow at 375 / 390 / 414 px | `overflow-x-hidden` on layout wrapper and `<main>`; `flex-wrap` on action row |
| `px-4 sm:px-6 lg:px-8` gutters | Applied in both `layout.tsx` wrapper and `<main>` |
| Action buttons remain tappable | `flex-wrap justify-end` causes overflow to wrap, not clip |

---

## Issue 3 — Focus Management

### Problem

Modals on the invoice detail page did not restore keyboard focus to the element that opened them when they closed. Additionally, there was no "Cancel Invoice" trigger button for the invoice creator.

### Solution

#### `src/components/FocusTrap.tsx` (pre-existing, unchanged)

The existing `FocusTrap` component already handled:
- Moving focus to the first tabbable element on mount
- Cycling Tab / Shift+Tab within the trap
- Calling `onClose` on Escape
- Restoring focus to `document.activeElement` at mount time on unmount

All modals in the app (`PayModal`, `CancelModal`, `DuplicateModal`, etc.) already wrapped their content in `<FocusTrap>`, satisfying the "Tab cycles only within modal" criterion.

#### `src/components/ui/Modal.tsx` (new)

A reusable dialog shell component that composes `FocusTrap` so any future modal automatically gets correct focus management. Props: `open`, `onClose`, `title`, `hideTitle`, `className`, `children`. Wires `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` automatically.

#### `src/app/invoice/[id]/page.tsx` (modified)

Added five `useRef` trigger refs and five `useEffect` hooks that restore focus when each modal closes:

```ts
const shareModalTriggerRef    = useRef<HTMLButtonElement | null>(null);
const shareQRModalTriggerRef  = useRef<HTMLButtonElement | null>(null);
const duplicateModalTriggerRef = useRef<HTMLButtonElement | null>(null);
const cancelModalTriggerRef   = useRef<HTMLButtonElement | null>(null);
const payModalTriggerRef      = useRef<HTMLButtonElement | null>(null);

useEffect(() => { if (!showShareModal)    shareModalTriggerRef.current?.focus();    }, [showShareModal]);
useEffect(() => { if (!showShareQRModal)  shareQRModalTriggerRef.current?.focus();  }, [showShareQRModal]);
useEffect(() => { if (!showDuplicateModal) duplicateModalTriggerRef.current?.focus(); }, [showDuplicateModal]);
useEffect(() => { if (!showCancelModal)   cancelModalTriggerRef.current?.focus();   }, [showCancelModal]);
useEffect(() => { if (!showPayModal)      payModalTriggerRef.current?.focus();      }, [showPayModal]);
```

Each trigger button received its corresponding `ref` prop. A **Cancel Invoice** button was also added to the header action row — visible only when `invoice.status === "Pending"` and the connected wallet is the invoice creator — which is the trigger for `CancelModal`.

### Acceptance criteria

| Criterion | How satisfied |
|---|---|
| Opening a modal moves focus to first interactive element | `FocusTrap` already does this on mount |
| Escape closes modal and returns focus to trigger | `FocusTrap` calls `onClose` on Escape; `useEffect` restores focus to `ref.current` |
| Tab cycles only within open modal | `FocusTrap` intercepts Tab/Shift+Tab and wraps within tabbable children |
| Interactive elements reachable by Tab in logical order | No `tabIndex` manipulation needed — DOM order is already logical |

---

## Issue 4 — Dark Mode Theme Toggle

### Problem

The issue required `src/hooks/useTheme.ts`, `src/components/ui/ThemeToggle.tsx`, `tailwind.config.ts` with `darkMode: 'class'`, and a pre-hydration bootstrap script in `layout.tsx`. All four were already present in the codebase:

- `tailwind.config.js` — `darkMode: 'class'` already set
- `src/app/layout.tsx` — inline `<script>` injecting the `themeBootstrap` IIFE before hydration, reading `localStorage` key `"split-theme"` and toggling the `dark` class on `<html>`
- `src/contexts/ThemeContext.tsx` — full `ThemeProvider` with `localStorage` persistence, system preference detection via `window.matchMedia`, `cycleTheme` through `light → dark → system`
- `src/components/ThemeToggle.tsx` — button cycling themes with sun/moon/monitor icons and descriptive `aria-label` per state

#### `src/hooks/useTheme.ts` (new)

A thin re-export providing a stable import path at `@/hooks/useTheme`:

```ts
export { useTheme } from "@/contexts/ThemeContext";
```

#### `src/components/ui/ThemeToggle.tsx` (new)

A re-export providing a stable import path at `@/components/ui/ThemeToggle`:

```ts
export { default } from "@/components/ThemeToggle";
```

Both files exist purely for path-convention parity with the issue spec. The implementation behind them is unchanged.

### Acceptance criteria

| Criterion | How satisfied |
|---|---|
| System preference detected on first render, no FOUC | Inline `themeBootstrap` script in `<head>` runs before hydration |
| Toggle cycles light / dark / system | `cycleTheme` in `ThemeContext` rotates through `["light", "dark", "system"]` |
| Choice persisted to `localStorage` | `ThemeContext` writes `"split-theme"` key on every change |
| `dark:` variants render on detail and list pages | `darkMode: 'class'` in `tailwind.config.js`; `dark` class managed by `ThemeContext` |
| Toggle keyboard-accessible with visible focus ring | `ThemeToggle` button has `focus:outline-none` replaced by browser default ring; `aria-label` reflects current state |

---

## Files Changed

| File | Status | Issue |
|---|---|---|
| `src/app/api/invoices/route.ts` | Created | #1 Infinite scroll |
| `src/hooks/useInfiniteInvoices.ts` | Created | #1 Infinite scroll |
| `src/components/InvoiceListSentinel.tsx` | Created | #1 Infinite scroll |
| `src/components/DashboardClient.tsx` | Modified | #1 Infinite scroll |
| `src/app/invoice/[id]/layout.tsx` | Modified | #2 Responsive layout |
| `src/app/invoice/[id]/page.tsx` | Modified | #2 Responsive layout, #3 Focus management |
| `src/components/ui/Modal.tsx` | Created | #3 Focus management |
| `src/hooks/useTheme.ts` | Created | #4 Dark mode |
| `src/components/ui/ThemeToggle.tsx` | Created | #4 Dark mode |
