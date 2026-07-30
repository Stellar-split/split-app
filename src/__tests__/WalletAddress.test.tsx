import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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

  it('shows a copy button and copies the address on click', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<WalletAddress address={ADDR} />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(ADDR);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });
});
