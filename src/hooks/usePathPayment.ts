'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

export interface PathPaymentResult {
  path: string[];
  sourceAsset: string;
  sourceAmount: string;
  destinationAsset: string;
  destinationAmount: string;
  exchangeRate: number;
  slippage: number; // percentage
}

export interface SelectedPath {
  hops: string[];
  effectiveRate: number;
  slippageEstimate: number;
}

interface UsePathPaymentOptions {
  sourceAsset?: string;
  destinationAsset: string;
  destinationAmount: string;
  enabled?: boolean;
}

// Mock exchange rates for testing
const MOCK_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'XLM': {
    'USDC': 0.1,
    'USDC:GBUQWP3BOUZX34YELLK4QVK6ZCCEAE3B4ZCBJMHWMRVRCVBVVZQNC5L': 0.1,
  },
  'USDC': {
    'XLM': 10,
  },
};

export function usePathPayment(options: UsePathPaymentOptions): {
  paths: PathPaymentResult[];
  selectedPath: SelectedPath | null;
  loading: boolean;
  error: string | null;
} {
  const { sourceAsset, destinationAsset, destinationAmount, enabled = true } = options;

  const [paths, setPaths] = useState<PathPaymentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPaths = useCallback(async () => {
    if (!enabled || !sourceAsset || !destinationAsset || !destinationAmount) {
      setPaths([]);
      return;
    }

    // If source and destination are the same, no path needed
    if (sourceAsset === destinationAsset) {
      setPaths([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get exchange rate (in production, use Stellar's path payment API)
      const sourceCode = sourceAsset.split(':')[0];
      const destCode = destinationAsset.split(':')[0];

      const rate = MOCK_EXCHANGE_RATES[sourceCode]?.[destinationAsset]
        || MOCK_EXCHANGE_RATES[sourceCode]?.[destCode]
        || 1;

      if (rate === undefined || rate === 0) {
        setError('No conversion path available for this asset pair');
        setPaths([]);
        return;
      }

      const destAmount = parseFloat(destinationAmount);
      const sourceAmount = destAmount / rate;
      const slippage = 1; // 1% default slippage tolerance

      setPaths([
        {
          path: sourceCode !== destCode ? [sourceAsset, destinationAsset] : [],
          sourceAsset,
          sourceAmount: sourceAmount.toFixed(7),
          destinationAsset,
          destinationAmount: destinationAmount,
          exchangeRate: rate,
          slippage,
        },
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payment paths';
      setError(errorMessage);
      setPaths([]);
    } finally {
      setLoading(false);
    }
  }, [sourceAsset, destinationAsset, destinationAmount, enabled]);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  const selectedPath = useMemo((): SelectedPath | null => {
    if (loading || paths.length === 0) return null;

    const lowestSlippagePath = paths.reduce((lowest, current) =>
      current.slippage < lowest.slippage ? current : lowest
    );

    return {
      hops: lowestSlippagePath.path,
      effectiveRate: lowestSlippagePath.exchangeRate,
      slippageEstimate: lowestSlippagePath.slippage,
    };
  }, [paths, loading]);

  return { paths, selectedPath, loading, error };
}
