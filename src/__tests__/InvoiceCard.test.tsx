import { render, screen } from '@testing-library/react';
import InvoiceCard from '@/components/InvoiceCard';
import type { Invoice } from '@stellar-split/sdk';

jest.mock('@stellar-split/sdk', () => ({
  formatAmount: (n: bigint) => `${n}`,
  truncateAddress: (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`,
}));

jest.mock('@/components/PaymentProgress', () => () => <div data-testid="payment-progress" />);
jest.mock('@/components/CountdownTimer', () => () => <div data-testid="countdown-timer" />);

const invoice: Invoice = {
  id: '42',
  funded: 50n,
  status: 'Pending',
  deadline: 0,
  recipients: [
    { address: 'GABCDEF1234', amount: 100n },
    { address: 'GXYZ9876WXYZ', amount: 100n },
  ],
} as unknown as Invoice;

describe('InvoiceCard', () => {
  it('renders invoice id', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText(/Invoice #42/)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders truncated recipient addresses', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText('GABC...1234')).toBeInTheDocument();
    expect(screen.getByText('GXYZ...WXYZ')).toBeInTheDocument();
  });

  it('renders funded amount', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText(/50.*USDC funded/)).toBeInTheDocument();
  });

  it('renders PaymentProgress', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByTestId('payment-progress')).toBeInTheDocument();
  });

  it('renders displayNumber when provided', () => {
    render(<InvoiceCard invoice={invoice} displayNumber="INV-001" />);
    expect(screen.getByText('(INV-001)')).toBeInTheDocument();
  });

  it('renders CountdownTimer when deadline > 0', () => {
    const withDeadline = { ...invoice, deadline: Math.floor(Date.now() / 1000) + 3600 };
    render(<InvoiceCard invoice={withDeadline} />);
    expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
  });

  it('does not render CountdownTimer when deadline is 0', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.queryByTestId('countdown-timer')).not.toBeInTheDocument();
  });
});
