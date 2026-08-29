import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceExportButton from '@/components/InvoiceExportButton';
import type { Invoice } from '@stellar-split/sdk';

// Mock the dynamic PDF import
jest.mock('@react-pdf/renderer', () => ({
  pdf: jest.fn(() => ({
    toBlob: jest.fn(async () => new Blob(['test'])),
  })),
  Document: jest.fn(() => null),
  Page: jest.fn(() => null),
  Text: jest.fn(() => null),
  View: jest.fn(() => null),
  StyleSheet: { create: jest.fn((obj) => obj) },
  Image: jest.fn(() => null),
}));

jest.mock('@/lib/branding', () => ({
  fetchBrandSettings: jest.fn(async () => ({})),
}));

describe('InvoiceExportButton', () => {
  const mockInvoice: Invoice = {
    id: 'test-id',
    creator: 'GTEST',
    recipients: [
      { address: 'GRECIPIENT', amount: 100n },
    ],
    payments: [],
    status: 'Pending',
    funded: 0n,
    token: 'USDC',
    deadline: 0,
  };

  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the export button', () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
  });

  it('should be enabled initially', () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    const button = screen.getByRole('button', { name: /export pdf/i });
    expect(button).not.toBeDisabled();
  });

  it('should be disabled while export is in progress', async () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    const button = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it('should show spinner icon while loading', async () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    const button = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(button);

    await waitFor(() => {
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('should show generating text while loading', async () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    const button = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent('Generating…');
    });
  });

  it('should return to normal state after export completes', async () => {
    render(
      <InvoiceExportButton
        invoice={mockInvoice}
        total={100n}
      />
    );

    const button = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Export PDF');
    });
  });
});
