# Snapshot testing

## Tooling

Snapshot tests use Vitest's built-in `toMatchSnapshot()` (no extra
dependency needed — Vitest is already the project's unit test runner, see
`vitest.config.ts`). Snapshots are rendered-DOM snapshots of a component's
`container` from `@testing-library/react`, consistent with every other
component test in this repo.

## What's covered

- `src/__tests__/snapshots/StatusBadge.snapshot.test.tsx` — all three sizes
  plus a custom description.
- `src/__tests__/snapshots/Skeleton.snapshot.test.tsx` — the base
  `Skeleton` primitive and the composed `SkeletonCard`.

These two components were chosen as the first snapshot targets because
they're small, purely presentational, and reused across many pages — making
them both cheap to snapshot and high-value to protect against accidental
markup/class changes.

## Running

```bash
npm test                 # runs all vitest tests, including snapshots
npx vitest run -u        # update snapshots after an intentional change
```

The first run of a new snapshot test creates `__snapshots__/*.snap` next to
the test file — **commit that file**. CI (`.github/workflows/unit-tests.yml`)
runs `vitest run --ci`, which fails the build if a snapshot is missing or
stale, so a snapshot update always has to go through a normal commit +
review, never an uncommitted local artifact.

## Review process

A snapshot diff in a PR is a signal, not an automatic approval or an
automatic rejection:

1. The reviewer reads the diff in the `.snap` file like any other code diff.
2. If the change matches the PR's stated intent (e.g. "updated StatusBadge's
   padding"), approve and merge.
3. If the change is unexpected, it's almost always an unintended
   regression — ask the author to investigate before approving, don't just
   `vitest run -u` it away.

## Avoiding snapshot sprawl

- Snapshot only small, presentational, low-churn components (badges,
  skeletons, icons) — not entire pages or components with frequently
  changing business data, which produce noisy diffs that reviewers learn to
  rubber-stamp.
- Prefer a behavioral assertion (`getByRole`, `getByText`, etc.) over a
  snapshot whenever the test is really checking specific behavior rather
  than "did the markup change at all."
- When a component is deleted or substantially rewritten, delete its
  snapshot file in the same PR instead of leaving an orphaned `.snap`.
