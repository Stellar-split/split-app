"use client";

import useSWR from "swr";

interface WalletBalance {
  xlm: string;
  usdc: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useWalletBalance(address: string | null, enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<WalletBalance>(
    enabled && address ? `/api/wallet/balance?address=${address}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      focusThrottleInterval: 30000,
    }
  );

  return {
    xlmBalance: data?.xlm ?? null,
    usdcBalance: data?.usdc ?? null,
    isLoading,
    error,
    refetch: mutate,
  };
}
