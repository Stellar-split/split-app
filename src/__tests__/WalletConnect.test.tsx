import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WalletConnect from '@/components/WalletConnect';
import { useWalletContext } from '@/contexts/WalletContext';

vi.mock('@/contexts/WalletContext');
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/stellar', () => ({ fetchUsdcBalance: vi.fn() }));
vi.mock('@/components/QRModal', () => ({ default: () => null }));
vi.mock('@/components/WalletErrorModal', () => ({ default: () => null }));

describe('WalletConnect', () => {
  const mockUseWalletContext = useWalletContext as ReturnType<typeof vi.fn>;
  const defaultMockReturn = {
    address: null,
    walletType: null,
    connecting: false,
    error: null,
    freighterInstalled: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWalletContext.mockReturnValue(defaultMockReturn);
  });

  describe('when Freighter is not installed', () => {
    beforeEach(() => {
      mockUseWalletContext.mockReturnValue({
        ...defaultMockReturn,
        freighterInstalled: false,
      });
    });

    it('shows install prompt message', () => {
      render(<WalletConnect />);
      expect(screen.getByText(/Freighter isn't installed/i)).toBeInTheDocument();
    });

    it('renders link to Freighter installation page', () => {
      render(<WalletConnect />);
      const link = screen.getByRole('link', { name: /Install Freighter/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://www.freighter.app/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render connect buttons', () => {
      render(<WalletConnect />);
      expect(screen.queryByRole('button', { name: /Connect/i })).not.toBeInTheDocument();
    });
  });

  describe('when Freighter is installed and disconnected', () => {
    beforeEach(() => {
      mockUseWalletContext.mockReturnValue({
        ...defaultMockReturn,
        freighterInstalled: true,
      });
    });

    it('renders connect buttons', () => {
      render(<WalletConnect />);
      expect(screen.getByRole('button', { name: /Connect with Freighter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect with WalletConnect/i })).toBeInTheDocument();
    });

    it('does not show install prompt', () => {
      render(<WalletConnect />);
      expect(screen.queryByText(/Freighter isn't installed/i)).not.toBeInTheDocument();
    });
  });

  describe('when connected', () => {
    beforeEach(() => {
      mockUseWalletContext.mockReturnValue({
        ...defaultMockReturn,
        address: 'GBUQWP3BOUZX34ULNQG23RQ6F4OYFBB5L6CSTX32G37B5HMXVY5Z5AAA',
        walletType: 'freighter',
        freighterInstalled: true,
      });
    });

    it('does not show install prompt', () => {
      render(<WalletConnect />);
      expect(screen.queryByText(/Freighter isn't installed/i)).not.toBeInTheDocument();
    });

    it('does not show connect buttons', () => {
      render(<WalletConnect />);
      expect(screen.queryByRole('button', { name: /^Connect/i })).not.toBeInTheDocument();
    });

    it('shows address badge and disconnect button', () => {
      render(<WalletConnect />);
      expect(screen.getByText(/^GBU.*AAA$/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders compact connect button when disconnected', () => {
      mockUseWalletContext.mockReturnValue({
        ...defaultMockReturn,
        freighterInstalled: true,
      });

      render(<WalletConnect compact />);
      expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
    });

    it('shows install prompt in compact mode when Freighter not installed', () => {
      mockUseWalletContext.mockReturnValue({
        ...defaultMockReturn,
        freighterInstalled: false,
      });

      render(<WalletConnect compact />);
      expect(screen.getByText(/Freighter isn't installed/i)).toBeInTheDocument();
    });
  });
});
