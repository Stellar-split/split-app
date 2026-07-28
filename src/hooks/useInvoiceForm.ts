'use client';

import { useState, useCallback, useEffect } from 'react';

interface RateLimitState {
  isRateLimited: boolean;
  resetTimestamp: number | null;
  retryAfterSeconds: number | null;
}

export function useInvoiceForm() {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    resetTimestamp: null,
    retryAfterSeconds: null,
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!rateLimitState.isRateLimited || !rateLimitState.resetTimestamp) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((rateLimitState.resetTimestamp! - now) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        setRateLimitState({
          isRateLimited: false,
          resetTimestamp: null,
          retryAfterSeconds: null,
        });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitState.isRateLimited, rateLimitState.resetTimestamp]);

  const handleRateLimit = useCallback((response: Response) => {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      const resetTimestamp = Date.now() + retryAfterSeconds * 1000;

      setRateLimitState({
        isRateLimited: true,
        resetTimestamp,
        retryAfterSeconds,
      });
      setSecondsRemaining(retryAfterSeconds);
    }
  }, []);

  const resetRateLimit = useCallback(() => {
    setRateLimitState({
      isRateLimited: false,
      resetTimestamp: null,
      retryAfterSeconds: null,
    });
    setSecondsRemaining(0);
  }, []);

  return {
    ...rateLimitState,
    secondsRemaining,
    handleRateLimit,
    resetRateLimit,
  };
}
