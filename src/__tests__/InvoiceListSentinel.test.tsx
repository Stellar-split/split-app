import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import InvoiceListSentinel from '@/components/InvoiceListSentinel';

describe('InvoiceListSentinel', () => {
  let observerMock: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn> };
  let constructorCalls: Array<[Function, IntersectionObserverInit | undefined]>;

  beforeEach(() => {
    constructorCalls = [];
    observerMock = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    };

    const obs = observerMock;
    const calls = constructorCalls;

    class MockIntersectionObserver {
      observe = obs.observe;
      disconnect = obs.disconnect;
      unobserve = obs.unobserve;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        calls.push([callback as unknown as Function, options]);
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should create an IntersectionObserver on mount', () => {
    const mockOnVisible = vi.fn();
    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
      />
    );

    expect(constructorCalls.length).toBeGreaterThan(0);
    expect(observerMock.observe).toHaveBeenCalled();
  });

  it('should disconnect the IntersectionObserver on unmount', () => {
    const mockOnVisible = vi.fn();
    const { unmount } = render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
      />
    );

    unmount();

    expect(observerMock.disconnect).toHaveBeenCalled();
  });

  it('should call onVisible when intersection is detected', async () => {
    const mockOnVisible = vi.fn();

    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
      />
    );

    const [callback] = constructorCalls[0];
    callback([{ isIntersecting: true }] as IntersectionObserverEntry[]);

    await waitFor(() => {
      expect(mockOnVisible).toHaveBeenCalled();
    });
  });

  it('should display loading spinner when loading is true', () => {
    const mockOnVisible = vi.fn();
    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={true}
        allLoaded={false}
      />
    );

    expect(screen.getByText('Loading more invoices…')).toBeInTheDocument();
  });

  it('should display all loaded message when allLoaded is true', () => {
    const mockOnVisible = vi.fn();
    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={true}
      />
    );

    expect(screen.getByText('All invoices loaded')).toBeInTheDocument();
  });

  it('should pass custom rootMargin to IntersectionObserver', () => {
    const mockOnVisible = vi.fn();
    const customMargin = '500px';

    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
        rootMargin={customMargin}
      />
    );

    const [, options] = constructorCalls[0];
    expect(options).toEqual({ rootMargin: customMargin });
  });
});
