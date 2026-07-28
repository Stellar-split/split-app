import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Use vi.hoisted to create the mock function before module resolution
const mockGetSplitClient = vi.hoisted(() => vi.fn());

// Mock all external deps using relative paths for vitest compatibility
vi.mock('@stellar/stellar-sdk', () => ({ rpc: { Server: vi.fn() } }));
vi.mock('@stellar-split/sdk', () => ({ StellarSplitClient: vi.fn(), formatAmount: vi.fn(), parseAmount: vi.fn(), truncateAddress: vi.fn() }));
vi.mock('../../lib/freighter', () => ({ NETWORK_PASSPHRASE: '', getFreighterPublicKey: vi.fn(), signWithFreighter: vi.fn() }));
vi.mock('../../lib/stellar', () => ({ getSplitClient: mockGetSplitClient }));

import { useInvoiceStream } from '../useInvoiceStream';

const mockInvoice = {
  id: '123',
  creator: 'GABC..',
  recipients: [{ address: 'GDEF..', amount: 100_000_000n }],
  token: 'USDC',
  deadline: 9999999999,
  funded: 50_000_000n,
  status: 'Pending' as const,
  payments: [{ payer: 'GXYZ..', amount: 50_000_000n }],
};

describe('useInvoiceStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetSplitClient.mockReturnValue({ getInvoice: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch initial invoice data', async () => {
    const fn = vi.fn().mockResolvedValue(mockInvoice);
    mockGetSplitClient.mockReturnValue({ getInvoice: fn });

    const { result } = renderHook(() => useInvoiceStream('123'));

    await waitFor(() => expect(result.current.invoice).not.toBeNull());

    expect(result.current.invoice?.id).toBe('123');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors gracefully', async () => {
    mockGetSplitClient.mockReturnValue({ getInvoice: vi.fn().mockRejectedValue(new Error('Network error')) });

    const { result } = renderHook(() => useInvoiceStream('123'));

    await waitFor(() => expect(result.current.error).toBe('Network error'));

    expect(result.current.invoice).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('should poll for invoice updates', async () => {
    const fn = vi.fn().mockResolvedValue(mockInvoice);
    mockGetSplitClient.mockReturnValue({ getInvoice: fn });

    renderHook(() => useInvoiceStream('123'));

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(3_000);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith('123');
  });

  it('should detect InvoiceReleased status change', async () => {
    const p = { ...mockInvoice, status: 'Pending' as const };
    const r = { ...mockInvoice, status: 'Released' as const };
    const fn = vi.fn().mockResolvedValueOnce(p).mockResolvedValue(r);
    mockGetSplitClient.mockReturnValue({ getInvoice: fn });

    const { result } = renderHook(() => useInvoiceStream('123'));

    await waitFor(() => expect(result.current.invoice?.status).toBe('Pending'));

    await vi.advanceTimersByTimeAsync(3_000);

    await waitFor(() => expect(result.current.latestEvent?.type).toBe('InvoiceReleased'));
  });

  it('should handle reconnection with exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('lost')).mockResolvedValue(mockInvoice);
    mockGetSplitClient.mockReturnValue({ getInvoice: fn });

    const { result } = renderHook(() => useInvoiceStream('123'));

    await waitFor(() => expect(result.current.error).toBe('lost'));
    expect(result.current.isConnected).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.invoice?.id).toBe('123');
  });

  it('should cleanup intervals on unmount', async () => {
    mockGetSplitClient.mockReturnValue({ getInvoice: vi.fn().mockResolvedValue(mockInvoice) });

    const spy = vi.spyOn(global, 'clearInterval');
    const { result, unmount } = renderHook(() => useInvoiceStream('123'));

    await waitFor(() => expect(result.current.invoice).not.toBeNull());

    unmount();
    expect(spy).toHaveBeenCalled();
  });
});