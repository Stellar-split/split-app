import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

const mockClipboard = {
  writeText: vi.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('copy sets copied to true and resets after 2 seconds', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  test('cleans up timeout on unmount while copied state is active', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test text');
    });

    expect(result.current.copied).toBe(true);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  test('does not produce warnings when component unmounts while in copied state', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test text');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a state update on an unmounted component")
    );

    consoleWarnSpy.mockRestore();
  });

  test('copy functionality continues to work as before', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('hello world');
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith('hello world');
    expect(result.current.copied).toBe(true);
  });
});
