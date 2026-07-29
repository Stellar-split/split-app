'use client';

import { useState, useEffect, useCallback } from 'react';

interface FeeBreakdown {
  baseFee: { stroops: number; xlm: number };
  resourceFee: { stroops: number; xlm: number };
  total: { stroops: number; xlm: number };
}

const STROOPS_PER_XLM = 10_000_000;

export function useNetworkFeeBreakdown() {
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fees');
      if (!response.ok) {
        throw new Error('Failed to fetch fee stats');
      }

      const data = await response.json();

      const baseFeeStroops = parseInt(data.baseFee || '100', 10);
      const resourceFeeStroops = parseInt(data.resourceFee || '0', 10);
      const totalStroops = baseFeeStroops + resourceFeeStroops;

      setFeeBreakdown({
        baseFee: {
          stroops: baseFeeStroops,
          xlm: baseFeeStroops / STROOPS_PER_XLM,
        },
        resourceFee: {
          stroops: resourceFeeStroops,
          xlm: resourceFeeStroops / STROOPS_PER_XLM,
        },
        total: {
          stroops: totalStroops,
          xlm: totalStroops / STROOPS_PER_XLM,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch fee breakdown';
      setError(message);
      setFeeBreakdown(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeStats();
  }, [fetchFeeStats]);

  return { feeBreakdown, isLoading, error, refetch: fetchFeeStats };
}
