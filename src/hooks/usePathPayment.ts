'use client';

import { useEffect, useState, useCallback } from 'react';
import { rpc } from '@stellar/stellar-sdk';

export interface PathPaymentResult {
  path: string[];
  sourceAsset: string;
  sourceAmount: string;
  destinationAsset: string;
  destinationAmount: string;
  exchangeRate: number;
  slippage: number; // percentage
}

interface UsePathPaymentOptions {
  sourceAsset?: string;
  destinationAsset: string;
  destinationAmount: string;
  enabled?: boolean;
}

export function usePathPayment(options: UsePathPaymentOptions): {
  paths: PathPaymentResult[];
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
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';
      const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });

      // Parse asset codes
      const [sourceCode, sourceIssuer] = sourceAsset.includes(':')
        ? sourceAsset.split(':')
        : [sourceAsset, undefined];
      const [destCode, destIssuer] = destinationAsset.includes(':')
        ? destinationAsset.split(':')
        : [destinationAsset, undefined];

      // Use strictReceivePaths to find conversion paths
      const pathResponse = await server.strictReceivePaths({
        sourceAssets: [
          {
            native: sourceCode === 'XLM',
            code: sourceCode !== 'XLM' ? sourceCode : undefined,
            issuer: sourceIssuer,
          },
        ],
        destinationAsset: {
          native: destCode === 'XLM',
          code: destCode !== 'XLM' ? destCode : undefined,
          issuer: destIssuer,
        },
        destinationAmount: destinationAmount,
      });

      if (pathResponse.records && pathResponse.records.length > 0) {
        const result = pathResponse.records[0];
        const sourceAmount = parseFloat(result.source_amount);
        const destAmount = parseFloat(result.destination_amount);
        const exchangeRate = destAmount / sourceAmount;
        const slippage = 1; // 1% default slippage tolerance

        setPaths([
          {
            path: result.path.map((asset: any) =>
              asset.native ? 'XLM' : `${asset.code}:${asset.issuer}`
            ),
            sourceAsset,
            sourceAmount: result.source_amount,
            destinationAsset,
            destinationAmount: result.destination_amount,
            exchangeRate,
            slippage,
          },
        ]);
      } else {
        setError('No conversion path available for this asset pair');
        setPaths([]);
      }
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

  return { paths, loading, error };
}
