"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

interface WalletBalance {
  xlm: string;
  usdc: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) {
    throw new Error(`Wallet balance request failed with status ${r.status}`);
  }
  return r.json();
});

export function useWalletBalance(address: string | null, enabled: boolean = true) {
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, error, isLoading, mutate } = useSWR<WalletBalance>(
    enabled && address ? `/api/wallet/balance?address=${address}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      focusThrottleInterval: 30000,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (!error) {
      retryCountRef.current = 0;
      setIsRetrying(false);
      return;
    }

    if (retryCountRef.current >= MAX_RETRIES) {
      setIsRetrying(false);
      return;
    }

    const delay = RETRY_DELAYS_MS[retryCountRef.current];
    retryCountRef.current += 1;
    setIsRetrying(true);

    retryTimeoutRef.current = setTimeout(() => {
      mutate();
    }, delay);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (data) {
      retryCountRef.current = 0;
      setIsRetrying(false);
    }
  }, [data]);

  const retriesExhausted = retryCountRef.current >= MAX_RETRIES;

  return {
    xlmBalance: data?.xlm ?? null,
    usdcBalance: data?.usdc ?? null,
    isLoading,
    isRetrying,
    error: error && retriesExhausted ? error : undefined,
    refetch: mutate,
  };
}
