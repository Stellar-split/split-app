import { render, screen } from '@testing-library/react';
import InvoiceCard from '@/components/InvoiceCard';
import type { Invoice } from '@stellar-split/sdk';
import { vi } from 'vitest';

vi.mock('@stellar-split/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar-split/sdk')>();
  return {
    ...actual,
    formatAmount: (n: bigint) => `${n}`,
    truncateAddress: (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`,
  };
});

vi.mock('@/components/PaymentProgress', () => ({
  default: () => <div data-testid="payment-progress" />
}));
vi.mock('@/components/CountdownTimer', () => ({
  default: () => <div data-testid="countdown-timer" />
}));
vi.mock('@/components/FundingProgress', () => ({
  default: () => <div data-testid="funding-progress" />
}));
vi.mock('@/components/StatusBadge', () => ({
  default: () => <div data-testid="status-badge">Pending</div>
}));
vi.mock('@/components/DeadlineCountdown', () => ({
  default: () => <div data-testid="deadline-countdown" />
}));

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
    expect(screen.getByText(/Invoice #42/)).toBeTruthy() // element exists in DOM;
  });

  it('renders status badge', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByTestId('status-badge')).toBeTruthy() // element exists in DOM;
  });

  it('renders truncated recipient addresses', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText('GABC...1234')).toBeTruthy() // element exists in DOM;
    expect(screen.getByText('GXYZ...WXYZ')).toBeTruthy() // element exists in DOM;
  });

  it('renders funded amount', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByText(/50.*USDC funded/)).toBeTruthy() // element exists in DOM;
  });

  it('renders FundingProgress', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.getByTestId('funding-progress')).toBeTruthy() // element exists in DOM;
  });

  it('renders displayNumber when provided', () => {
    render(<InvoiceCard invoice={invoice} displayNumber="INV-001" />);
    expect(screen.getByText('(INV-001)')).toBeTruthy() // element exists in DOM;
  });

  it('renders DeadlineCountdown when deadline > 0', () => {
    const withDeadline = { ...invoice, deadline: Math.floor(Date.now() / 1000) + 3600 };
    render(<InvoiceCard invoice={withDeadline} />);
    expect(screen.getByTestId('deadline-countdown')).toBeTruthy() // element exists in DOM;
  });

  it('does not render DeadlineCountdown when deadline is 0', () => {
    render(<InvoiceCard invoice={invoice} />);
    expect(screen.queryByTestId('deadline-countdown')).not.toBeTruthy() // element exists in DOM;
  });
});
