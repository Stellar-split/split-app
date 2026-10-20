import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SplitPaymentConfirmationModal } from '@/components/SplitPaymentConfirmation';
import type { SplitPaymentConfirmation, SplitPaymentResult } from '@/types/splitPayment';

const MOCK_CONFIRMATION: SplitPaymentConfirmation = {
  request: {
    id: 'sp_test_1',
    payerAddress: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    totalAmount: 100,
    assetCode: 'USDC',
    recipients: [
      { address: 'GDNJ22TG7PGTDFB46L7TA3R6S4F7Z3HQALNPYZ5BTRUT7Y2L73PBGBH5', sharePercent: 60, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', sharePercent: 40, taxRatePercent: 0, fixedFeeXLM: 0 },
    ],
  },
  derivedLines: [
    { address: 'GDNJ22TG7PGTDFB46L7TA3R6S4F7Z3HQALNPYZ5BTRUT7Y2L73PBGBH5', sharePercent: 60, taxRatePercent: 0, fixedFeeXLM: 0, grossAmount: 60, effectiveTaxAmount: 0, netAmount: 60 },
    { address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', sharePercent: 40, taxRatePercent: 0, fixedFeeXLM: 0, grossAmount: 40, effectiveTaxAmount: 0, netAmount: 40 },
  ],
  validation: {
    sharesSumTo100: true,
    sharesDelta: 0,
    hasValidTotal: true,
    hasRecipients: true,
    allSharesNonNegative: true,
    allTaxRatesValid: true,
    allFeesNonNegative: true,
    isValid: true,
    errorMessage: null,
  },
  rules: [
    { type: 'min_amount', description: 'Min amount check', passed: true },
    { type: 'unique_addresses', description: 'Unique addresses check', passed: true },
  ],
  allRulesPassed: true,
  totalGross: 100,
  totalTax: 0,
  totalFees: 0,
  totalNet: 100,
  userConfirmed: false,
  createdAt: Date.now(),
};

describe('SplitPaymentConfirmationModal', () => {
  it('renders confirmation modal with rules and recipients', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <SplitPaymentConfirmationModal
        confirmation={MOCK_CONFIRMATION}
        status="confirmed"
        isExecuting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Split Payment')).toBeInTheDocument();
    expect(screen.getByText('Min amount check')).toBeInTheDocument();
    expect(screen.getByText('Unique addresses check')).toBeInTheDocument();
    expect(screen.getByText('60.0000000 USDC')).toBeInTheDocument();
    expect(screen.getByText('40.0000000 USDC')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm & execute/i });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('disables confirm button when rules fail or is executing', () => {
    const failingConfirmation: SplitPaymentConfirmation = {
      ...MOCK_CONFIRMATION,
      allRulesPassed: false,
    };

    const { rerender } = render(
      <SplitPaymentConfirmationModal
        confirmation={failingConfirmation}
        status="confirmed"
        isExecuting={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /confirm & execute/i })).toBeDisabled();

    // While executing
    rerender(
      <SplitPaymentConfirmationModal
        confirmation={MOCK_CONFIRMATION}
        status="executing"
        isExecuting={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /distributing.../i })).toBeDisabled();
  });

  it('displays status banner and closes when completed', () => {
    const mockResult: SplitPaymentResult = {
      request: MOCK_CONFIRMATION.request,
      status: 'completed',
      recipientResults: [
        {
          address: 'GDNJ22TG7PGTDFB46L7TA3R6S4F7Z3HQALNPYZ5BTRUT7Y2L73PBGBH5',
          amount: 60,
          sharePercent: 60,
          status: 'succeeded',
          retryCount: 0,
          initiatedAt: Date.now(),
        },
      ],
      successCount: 1,
      failureCount: 0,
      totalDistributed: 60,
      totalFailed: 0,
      startedAt: Date.now(),
    };

    const onCancel = vi.fn();
    render(
      <SplitPaymentConfirmationModal
        confirmation={MOCK_CONFIRMATION}
        result={mockResult}
        status="completed"
        isExecuting={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(
      screen.getByText(/All 1 recipient payments distributed successfully!/i)
    ).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
