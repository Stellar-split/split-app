"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getCachedCsrfExpiry, getCsrfToken } from "@/lib/apiClient";

const REFRESH_SKEW_MS = 60 * 1000;

export interface UseCsrfTokenResult {
  token: string | null;
  loading: boolean;
  /** Force-fetch a new token, e.g. after an unexpected 403. */
  refresh: () => Promise<string>;
  /** CSRF-protected fetch — attaches the token and retries once on 403. */
  fetchWithCsrf: typeof apiFetch;
}

/** Fetches a CSRF token on mount and keeps it refreshed until unmount. */
export function useCsrfToken(): UseCsrfTokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const fresh = await getCsrfToken(forceRefresh);
      setToken(fresh);
      return fresh;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const scheduleRefresh = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        await load(true);
        scheduleRefresh(Math.max(getCachedCsrfExpiry() - Date.now() - REFRESH_SKEW_MS, REFRESH_SKEW_MS));
      }, delayMs);
    };

    load().then(() => {
      if (cancelled) return;
      scheduleRefresh(Math.max(getCachedCsrfExpiry() - Date.now() - REFRESH_SKEW_MS, REFRESH_SKEW_MS));
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { token, loading, refresh, fetchWithCsrf: apiFetch };
}
