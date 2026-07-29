'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  calculatePlatformFee,
  calculateReserveTopUp,
  getAddOnCosts,
  type FeatureAddOn,
} from '@/lib/feeConfig';

export interface CostBreakdown {
  networkFeeXlm: number;
  reserveTopUpXlm: number;
  platformFeeXlm: number;
  addOnCostsXlm: number;
  totalXlm: number;
}

interface UseInvoiceCostEstimateParams {
  invoiceAmountXlm: number;
  recipientAddresses: string[];
  creatorAddress: string;
  enabledAddOns?: FeatureAddOn[];
  feeTierMultiplier?: number;
}

const BASE_NETWORK_FEE_XLM = 0.00001; // 100 stroops

export function useInvoiceCostEstimate({
  invoiceAmountXlm,
  recipientAddresses,
  creatorAddress,
  enabledAddOns = [],
  feeTierMultiplier = 1,
}: UseInvoiceCostEstimateParams) {
  const [existingTrustlines, setExistingTrustlines] = useState<Set<string>>(new Set());
  const [creatorBalance, setCreatorBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountData = async () => {
      if (!creatorAddress || !recipientAddresses.length) return;

      setLoading(true);
      setError(null);

      try {
        const { Horizon } = await import('@stellar/stellar-sdk');
        const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
        const server = new Horizon.Server(horizonUrl);

        // Fetch creator account for balance and existing trustlines
        const creatorAccount = await server.loadAccount(creatorAddress);
        const balances = creatorAccount.balances;
        const nativeBalance = balances.find((b: any) => b.asset_type === 'native');
        setCreatorBalance(parseFloat(nativeBalance?.balance || '0'));

        const trustlines = new Set<string>();
        balances.forEach((b: any) => {
          if (b.asset_type !== 'native') {
            trustlines.add(`${b.asset_code}:${b.asset_issuer}`);
          }
        });
        setExistingTrustlines(trustlines);
      } catch (err) {
        console.error('Failed to fetch account data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load account data');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [creatorAddress, recipientAddresses]);

  const breakdown = useMemo((): CostBreakdown => {
    const networkFeeXlm = BASE_NETWORK_FEE_XLM * feeTierMultiplier;
    const platformFeeXlm = calculatePlatformFee(invoiceAmountXlm);

    // Estimate new trustlines needed (simplified: assume each recipient might need one)
    // In reality, this would depend on assets being transferred
    const estimatedNewTrustlines = Math.max(0, recipientAddresses.length - 1);
    const reserveTopUpXlm = calculateReserveTopUp(estimatedNewTrustlines);

    const addOnCostsXlm = getAddOnCosts(enabledAddOns);

    const totalXlm = networkFeeXlm + platformFeeXlm + reserveTopUpXlm + addOnCostsXlm;

    return {
      networkFeeXlm,
      reserveTopUpXlm,
      platformFeeXlm,
      addOnCostsXlm,
      totalXlm,
    };
  }, [invoiceAmountXlm, recipientAddresses.length, feeTierMultiplier, enabledAddOns]);

  const isBalanceSufficient = useMemo(() => {
    if (creatorBalance === null) return null;
    return creatorBalance >= invoiceAmountXlm + breakdown.totalXlm;
  }, [creatorBalance, invoiceAmountXlm, breakdown.totalXlm]);

  return {
    breakdown,
    isBalanceSufficient,
    creatorBalance,
    loading,
    error,
  };
}
