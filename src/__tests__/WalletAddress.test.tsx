import { render, screen } from '@testing-library/react';
import WalletAddress from '@/components/WalletAddress';

const ADDR = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567';

describe('WalletAddress', () => {
  it('renders truncated address by default', () => {
    render(<WalletAddress address={ADDR} />);
    const span = screen.getByTitle(ADDR);
    expect(span).toHaveTextContent(`${ADDR.slice(0, 4)}…${ADDR.slice(-4)}`);
  });

  it('renders full address when truncate=false', () => {
    render(<WalletAddress address={ADDR} truncate={false} />);
    expect(screen.getByText(ADDR)).toBeInTheDocument();
  });

  it('sets title to full address', () => {
    render(<WalletAddress address={ADDR} />);
    expect(screen.getByTitle(ADDR)).toBeInTheDocument();
  });
});
