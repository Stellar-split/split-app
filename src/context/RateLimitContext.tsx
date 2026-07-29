"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  subscribeRateLimit,
  getCurrentRateLimitRetryAt,
} from "@/lib/api";

interface RateLimitContextValue {
  /** Unix ms timestamp when the retry will fire, or null when not rate-limited. */
  retryAt: number | null;
}

const RateLimitContext = createContext<RateLimitContextValue>({ retryAt: null });

export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [retryAt, setRetryAt] = useState<number | null>(getCurrentRateLimitRetryAt);

  useEffect(() => {
    const unsub = subscribeRateLimit(setRetryAt);
    return unsub;
  }, []);

  return (
    <RateLimitContext.Provider value={{ retryAt }}>
      {children}
    </RateLimitContext.Provider>
  );
}

export function useRateLimit(): RateLimitContextValue {
  return useContext(RateLimitContext);
}
