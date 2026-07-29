'use client';

import { useMemo } from 'react';
import { MAX_RECIPIENTS } from '@/lib/stellar';

export interface RecipientLine {
  address: string;
  sharePercent: number;
  taxRatePercent: number;
  fixedFeeXLM: number;
}

export interface DerivedRecipientLine extends RecipientLine {
  grossAmount: number;
  effectiveTaxAmount: number;
  netAmount: number;
}

export interface SplitMeta {
  totalAmount: number;
  assetCode: 'XLM' | 'USDC';
  recipients: RecipientLine[];
  installments?: { id: string; amount: number; dueDate: number; status: string; txHash?: string }[];
}

export interface SplitValidation {
  sharesSumTo100: boolean;
  sharesDelta: number;
  hasValidTotal: boolean;
  hasRecipients: boolean;
  allSharesNonNegative: boolean;
  allTaxRatesValid: boolean;
  allFeesNonNegative: boolean;
  isValid: boolean;
  errorMessage: string | null;
}

export interface SplitCalculatorResult {
  derivedLines: DerivedRecipientLine[];
  totalGross: number;
  totalTax: number;
  totalFees: number;
  totalNet: number;
  validation: SplitValidation;
  canAddRecipient: boolean;
  recipientCount: number;
}

const STROOP_SCALE = 1e7;

function roundToStroops(value: number): number {
  return Math.round(value * STROOP_SCALE) / STROOP_SCALE;
}

export function validateShares(recipients: RecipientLine[]): SplitValidation {
  const sharesSum = recipients.reduce((s, r) => s + (r.sharePercent || 0), 0);
  const sharesDelta = Math.abs(100 - sharesSum);
  const sharesSumTo100 = sharesDelta < 0.0001;
  const allSharesNonNegative = recipients.every((r) => r.sharePercent >= 0);
  const allTaxRatesValid = recipients.every(
    (r) => r.taxRatePercent >= 0 && r.taxRatePercent <= 100
  );
  const allFeesNonNegative = recipients.every((r) => r.fixedFeeXLM >= 0);
  const hasRecipients = recipients.length > 0;

  let errorMessage: string | null = null;
  if (!hasRecipients) {
    errorMessage = 'At least one recipient is required';
  } else if (!allSharesNonNegative) {
    errorMessage = 'Share percentages must be non-negative';
  } else if (!sharesSumTo100) {
    errorMessage = `Share percentages must sum to 100% (current sum: ${sharesSum.toFixed(4)}%)`;
  } else if (!allTaxRatesValid) {
    errorMessage = 'Tax rates must be between 0% and 100%';
  } else if (!allFeesNonNegative) {
    errorMessage = 'Fixed fees must be non-negative';
  }

  return {
    sharesSumTo100,
    sharesDelta,
    hasValidTotal: true,
    hasRecipients,
    allSharesNonNegative,
    allTaxRatesValid,
    allFeesNonNegative,
    isValid:
      hasRecipients &&
      sharesSumTo100 &&
      allSharesNonNegative &&
      allTaxRatesValid &&
      allFeesNonNegative,
    errorMessage,
  };
}

export function calculateSplit(
  totalAmount: number,
  recipients: RecipientLine[],
  _assetCode: 'XLM' | 'USDC' = 'USDC'
): SplitCalculatorResult {
  const totalNum = totalAmount || 0;
  const validation = validateShares(recipients);

  const derivedLines: DerivedRecipientLine[] = recipients.map((r) => {
    const grossAmount = roundToStroops((totalNum * (r.sharePercent || 0)) / 100);
    const preFeeAmount = grossAmount;
    const effectiveTaxAmount = roundToStroops(
      (preFeeAmount * (r.taxRatePercent || 0)) / 100
    );
    const afterTax = preFeeAmount - effectiveTaxAmount;
    const netAmount = roundToStroops(Math.max(0, afterTax - (r.fixedFeeXLM || 0)));

    return {
      ...r,
      grossAmount,
      effectiveTaxAmount,
      netAmount,
    };
  });

  const totalGross = roundToStroops(
    derivedLines.reduce((s, r) => s + r.grossAmount, 0)
  );
  const totalTax = roundToStroops(
    derivedLines.reduce((s, r) => s + r.effectiveTaxAmount, 0)
  );
  const totalFees = roundToStroops(
    derivedLines.reduce((s, r) => s + r.fixedFeeXLM, 0)
  );
  const totalNet = roundToStroops(
    derivedLines.reduce((s, r) => s + r.netAmount, 0)
  );

  return {
    derivedLines,
    totalGross,
    totalTax,
    totalFees,
    totalNet,
    validation,
    canAddRecipient: recipients.length < MAX_RECIPIENTS,
    recipientCount: recipients.length,
  };
}

export function useSplitCalculator(
  totalAmount: number,
  recipients: RecipientLine[],
  assetCode: 'XLM' | 'USDC' = 'USDC'
): SplitCalculatorResult {
  return useMemo(
    () => calculateSplit(totalAmount, recipients, assetCode),
    [totalAmount, recipients, assetCode]
  );
}

export function defaultRecipientLine(address = ''): RecipientLine {
  return {
    address,
    sharePercent: 0,
    taxRatePercent: 0,
    fixedFeeXLM: 0,
  };
}
