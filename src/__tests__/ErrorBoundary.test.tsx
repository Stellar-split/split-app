import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ErrorBoundary from '@/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when error is caught', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays copy button for error details', () => {
    const TestComponent = () => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    const copyButton = screen.getByText('Copy error details');
    expect(copyButton).toBeInTheDocument();
  });

  it('copies error details to clipboard when button is clicked', async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    const TestComponent = () => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    const copyButton = screen.getByText('Copy error details');
    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
      expect(mockClipboard.writeText.mock.calls[0][0]).toContain('Test error message');
    });
  });

  it('shows copied confirmation for 2 seconds', async () => {
    vi.useFakeTimers();
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    const TestComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    const copyButton = screen.getByText('Copy error details');
    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText('Copy error details')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('renders reload and dashboard buttons', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });
});
