import { renderHook, act, waitFor } from '@testing-library/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

jest.useFakeTimers();

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('copy sets copied to true and resets after 2 seconds', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);

    act(() => {
      result.current.copy('test text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  test('cleans up timeout on unmount while copied state is active', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { result, unmount } = renderHook(() => useCopyToClipboard());

    act(() => {
      result.current.copy('test text');
    });

    expect(result.current.copied).toBe(true);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  test('does not produce warnings when component unmounts while in copied state', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result, unmount } = renderHook(() => useCopyToClipboard());

    act(() => {
      result.current.copy('test text');
    });

    // Unmount before timeout completes
    unmount();

    // Advance time past when the timeout would have fired
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a state update on an unmounted component")
    );

    consoleWarnSpy.mockRestore();
  });

  test('copy functionality continues to work as before', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCopyToClipboard());

    act(() => {
      result.current.copy('hello world');
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith('hello world');
    expect(result.current.copied).toBe(true);
  });
});
