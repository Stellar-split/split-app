import { render, screen, waitFor } from '@testing-library/react';
import InvoiceListSentinel from '@/components/InvoiceListSentinel';

describe('InvoiceListSentinel', () => {
  let observerMock: { observe: jest.Mock; disconnect: jest.Mock; unobserve: jest.Mock };
  let IntersectionObserverMock: jest.Mock;

  beforeEach(() => {
    observerMock = {
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    };

    IntersectionObserverMock = jest.fn(() => observerMock);
    (global as any).IntersectionObserver = IntersectionObserverMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create an IntersectionObserver on mount', () => {
    const mockOnVisible = jest.fn();
    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
      />
    );

    expect(IntersectionObserverMock).toHaveBeenCalled();
    expect(observerMock.observe).toHaveBeenCalled();
  });

  it('should disconnect the IntersectionObserver on unmount', () => {
    const mockOnVisible = jest.fn();
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

  it('should call onVisible when intersection is detected', () => {
    const mockOnVisible = jest.fn();
    IntersectionObserverMock.mockImplementation((callback) => {
      setTimeout(() => {
        callback([{ isIntersecting: true }] as any);
      }, 0);
      return observerMock;
    });

    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
      />
    );

    waitFor(() => {
      expect(mockOnVisible).toHaveBeenCalled();
    });
  });

  it('should display loading spinner when loading is true', () => {
    const mockOnVisible = jest.fn();
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
    const mockOnVisible = jest.fn();
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
    const mockOnVisible = jest.fn();
    const customMargin = '500px';

    render(
      <InvoiceListSentinel
        onVisible={mockOnVisible}
        loading={false}
        allLoaded={false}
        rootMargin={customMargin}
      />
    );

    const callArgs = IntersectionObserverMock.mock.calls[0];
    expect(callArgs[1]).toEqual({ rootMargin: customMargin });
  });
});
