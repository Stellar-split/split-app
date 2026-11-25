import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSplitPayment } from '@/hooks/useSplitPayment';
import type { PaymentExecutor } from '@/types/splitPayment';
import type { RecipientLine } from '@/hooks/useSplitCalculator';

const VALID_ADDR_1 = 'GDNJ22TG7PGTDFB46L7TA3R6S4F7Z3HQALNPYZ5BTRUT7Y2L73PBGBH5';
const VALID_ADDR_2 = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const PAYER_ADDR = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

describe('useSplitPayment hook', () => {
  const recipients: RecipientLine[] = [
    { address: VALID_ADDR_1, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
    { address: VALID_ADDR_2, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
  ];

  it('prepares confirmation and executes workflow cleanly', async () => {
    const mockExecutor: PaymentExecutor = vi.fn().mockResolvedValue({ txHash: 'tx_abc' });
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useSplitPayment({
        executor: mockExecutor,
        onComplete,
      })
    );

    expect(result.current.state.status).toBe('pending');
    expect(result.current.state.confirmation).toBeNull();

    // 1. Prepare Split
    act(() => {
      result.current.prepareSplit(PAYER_ADDR, 100, 'USDC', recipients);
    });

    expect(result.current.state.status).toBe('confirmed');
    expect(result.current.state.confirmation).not.toBeNull();
    expect(result.current.state.confirmation?.allRulesPassed).toBe(true);

    // 2. Confirm and execute
    await act(async () => {
      await result.current.confirmAndExecute();
    });

    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.result?.successCount).toBe(2);
    expect(mockExecutor).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalled();
  });

  it('handles cancellation and reset', () => {
    const mockExecutor: PaymentExecutor = vi.fn();
    const { result } = renderHook(() => useSplitPayment({ executor: mockExecutor }));

    act(() => {
      result.current.prepareSplit(PAYER_ADDR, 100, 'USDC', recipients);
    });
    expect(result.current.state.status).toBe('confirmed');

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.status).toBe('cancelled');

    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe('pending');
    expect(result.current.state.confirmation).toBeNull();
  });
});
