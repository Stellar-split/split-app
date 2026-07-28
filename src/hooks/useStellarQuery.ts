"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BACKOFF_MS = 30_000;

/** attempt 0 -> 1s, 1 -> 2s, 2 -> 4s, ... capped at 30s. Shared with StellarErrorBoundary. */
export function backoffDelay(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
}

interface UseStellarQueryOptions {
  /** Set false to disable the run (e.g. waiting on a required id). Default true. */
  enabled?: boolean;
}

interface UseStellarQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  /** Resets and refetches immediately, without needing a remount. */
  retry: () => void;
}

/**
 * Runs a Stellar Horizon/Soroban RPC call. On failure it throws during
 * render so the nearest error boundary (StellarErrorBoundary) can catch it
 * — a plain state-based error doesn't reach class-component boundaries, a
 * render-phase throw does. Retry timing/backoff/attempt-count is owned by
 * the boundary (clearing its error state remounts this hook's owner, which
 * naturally re-runs the query), not this hook, so there's a single source
 * of truth for "how many times have we tried."
 */
export function useStellarQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  options: UseStellarQueryOptions = {},
): UseStellarQueryResult<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [throwError, setThrowError] = useState<Error | null>(null);
  const [generation, setGeneration] = useState(0);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  if (throwError) {
    throw throwError;
  }

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setIsLoading(true);

    queryFnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setIsLoading(false);
        setThrowError(e instanceof Error ? e : new Error(String(e)));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, generation, ...deps]);

  const retry = () => {
    setThrowError(null);
    setGeneration((g) => g + 1);
  };

  return { data, isLoading, retry };
}
