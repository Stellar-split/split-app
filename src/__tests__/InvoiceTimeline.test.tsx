import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InvoiceTimeline from '@/components/InvoiceTimeline';
import type { InvoiceEvent } from '@/components/InvoiceTimeline';

const mockEventsData: InvoiceEvent[] = [
  {
    type: 'Created',
    description: 'Invoice created',
    timestamp: Math.floor(Date.now() / 1000),
    actor: 'GCREATOR',
    txHash: 'abc123def456',
  },
  {
    type: 'PaymentReceived',
    description: '100 USDC received',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    actor: 'GPAYER',
    txHash: 'def789ghi012',
  },
];

const { mockGetInvoiceEvents } = vi.hoisted(() => ({
  mockGetInvoiceEvents: vi.fn(),
}));

vi.mock('@/lib/stellar', () => ({
  splitClient: {
    getInvoiceEvents: (...args: any[]) => mockGetInvoiceEvents(...args),
  },
}));

vi.mock('@/components/WalletAddress', () => ({
  default: function MockWalletAddress({ address }: any) {
    return <span>{address}</span>;
  },
}));

vi.mock('@/components/ui/RelativeTime', () => ({
  default: function MockRelativeTime({ iso }: any) {
    return <span>{new Date(iso).toLocaleString()}</span>;
  },
}));

describe('InvoiceTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInvoiceEvents.mockResolvedValue({
      events: mockEventsData,
      nextCursor: undefined,
    });
  });

  it('should render timeline events', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      expect(screen.queryByText(/Created/i)).toBeInTheDocument();
    });
  });

  it('should render show details button for events with details', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButtons = screen.getAllByText(/Show details/i);
      expect(showDetailsButtons.length).toBeGreaterThan(0);
    });
  });

  it('should expand details when show details button is clicked', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButton = screen.getAllByText(/Show details/i)[0];
      fireEvent.click(showDetailsButton);

      expect(showDetailsButton).toHaveTextContent(/Hide details/i);
    });
  });

  it('should collapse details when hide details button is clicked', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButton = screen.getAllByText(/Show details/i)[0];
      fireEvent.click(showDetailsButton);

      const hideDetailsButton = screen.getByText(/Hide details/i);
      fireEvent.click(hideDetailsButton);

      expect(screen.getByText(/Show details/i)).toBeInTheDocument();
    });
  });

  it('should display actor address when details are expanded', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButtons = screen.getAllByText(/Show details/i);
      if (showDetailsButtons.length > 0) {
        fireEvent.click(showDetailsButtons[0]);

        expect(screen.getByText(/GCREATOR|GPAYER/)).toBeInTheDocument();
      }
    });
  });

  it('should display transaction hash link when details are expanded', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButtons = screen.getAllByText(/Show details/i);
      if (showDetailsButtons.length > 0) {
        fireEvent.click(showDetailsButtons[0]);

        const txLinks = screen.getAllByRole('link');
        expect(txLinks.length).toBeGreaterThan(0);
      }
    });
  });

  it('should have correct aria-expanded attribute', async () => {
    render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButtons = screen.getAllByText(/Show details/i);
      if (showDetailsButtons.length > 0) {
        const button = showDetailsButtons[0].closest('button');
        expect(button).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(showDetailsButtons[0]);

        expect(button).toHaveAttribute('aria-expanded', 'true');
      }
    });
  });

  it('should apply animation classes to details section', async () => {
    const { container } = render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const detailsSections = container.querySelectorAll('.timeline-details');
      expect(detailsSections.length).toBeGreaterThan(0);

      detailsSections.forEach((section) => {
        expect(section.classList.contains('collapsed')).toBe(true);
      });
    });
  });

  it('should toggle animation classes when expanding', async () => {
    const { container } = render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const showDetailsButtons = screen.getAllByText(/Show details/i);
      if (showDetailsButtons.length > 0) {
        const detailsSection = container.querySelector('.timeline-details');
        expect(detailsSection?.classList.contains('collapsed')).toBe(true);

        fireEvent.click(showDetailsButtons[0]);

        waitFor(() => {
          expect(detailsSection?.classList.contains('expanded')).toBe(true);
        });
      }
    });
  });

  it('should render animation CSS rules', async () => {
    const { container } = render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const styleTag = container.querySelector('style');
      expect(styleTag).toBeInTheDocument();
      expect(styleTag?.textContent).toContain('timeline-details');
      expect(styleTag?.textContent).toContain('max-height');
      expect(styleTag?.textContent).toContain('transition');
    });
  });

  it('should respect prefers-reduced-motion', async () => {
    const { container } = render(<InvoiceTimeline invoiceId="test-id" />);

    await waitFor(() => {
      const styleTag = container.querySelector('style');
      expect(styleTag?.textContent).toContain('prefers-reduced-motion');
    });
  });
});
