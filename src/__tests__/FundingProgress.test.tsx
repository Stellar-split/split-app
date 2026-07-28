import { render, screen } from '@testing-library/react';
import PaymentProgress from '@/components/PaymentProgress';
import type { Invoice } from '@stellar-split/sdk';

jest.mock('@stellar-split/sdk', () => ({
  formatAmount: (n: bigint) => `${n}`,
}));

const makeInvoice = (funded: bigint, amount: bigint): Invoice =>
  ({
    id: '1',
    funded,
    status: 'Pending',
    deadline: 0,
    recipients: [{ address: 'GABC', amount }],
  } as unknown as Invoice);

describe('PaymentProgress', () => {
  it('renders progressbar role', () => {
    render(<PaymentProgress funded={0n} total={100n} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows 0% when nothing funded', () => {
    render(<PaymentProgress funded={0n} total={100n} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows 50% when half funded', () => {
    render(<PaymentProgress funded={50n} total={100n} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('clamps at 100%', () => {
    render(<PaymentProgress funded={200n} total={100n} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows 0% when total is 0', () => {
    render(<PaymentProgress funded={0n} total={0n} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('derives amounts from invoice prop', () => {
    render(<PaymentProgress invoice={makeInvoice(25n, 100n)} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('shows funded/total text when invoice is provided', () => {
    render(<PaymentProgress invoice={makeInvoice(40n, 200n)} />);
    expect(screen.getByText(/40.*200.*USDC funded/)).toBeInTheDocument();
  });

  it('does not show funded text without invoice', () => {
    render(<PaymentProgress funded={50n} total={100n} />);
    expect(screen.queryByText(/USDC funded/)).not.toBeInTheDocument();
  });
});
