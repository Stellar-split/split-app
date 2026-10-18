# Continuous testing in local development

Vitest runs in watch mode during development, giving fast feedback on each
file save instead of waiting for a full `npm test` run.

## Commands

- `npm run test:watch` — watches the filesystem and, on every change, reruns
  only the tests affected by that change (`vitest --changed`). This is the
  default for day-to-day development: the feedback loop stays fast because
  unrelated suites are skipped.
- `npm run test:watch:all` — watches the filesystem and reruns the full test
  suite on every change. Use this when working on shared setup/config code,
  or when you want to be sure nothing else broke.
- `npm test` — single run, no watching. Used in CI.

## How it works

- **File watch detection**: Vitest's watcher picks up changes to any file
  under `src/` as soon as they're saved.
- **Affected tests on change**: `--changed` asks Vitest to only run test
  files that import (directly or transitively) the files that changed since
  the last commit/run, so the loop stays fast on a large suite.
- **Clear results / notifications**: the default reporter prints a pass/fail
  summary after every rerun, with failing assertions and their file:line
  shown inline so you don't have to scroll.
- **Intelligent caching**: `vitest.config.ts` sets a persistent cache
  directory (`node_modules/.vitest-cache`) so Vitest doesn't need to
  re-discover and re-parse the whole project graph on every save, and
  `forceRerunTriggers` forces a full rerun when shared config/setup files
  change (since those can affect any test regardless of its own imports).

## Tips

- Press `h` in the Vitest watch CLI for the interactive command list
  (filter by filename/test name, rerun all, quit).
- If a rerun looks stale after renaming/deleting files, press `o` or restart
  the watcher — the on-disk cache is safe to delete at any time
  (`rm -rf node_modules/.vitest-cache`).
