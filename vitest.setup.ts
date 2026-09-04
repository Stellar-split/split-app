import '@testing-library/jest-dom';
import { vi } from 'vitest';

(globalThis as any).jest = vi as any;

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...rest }: any) => {
    const React = require('react');
    return React.createElement('a', { href, className, ...rest }, children);
  },
}));

vi.mock('@stellar/freighter-api', () => ({
  getPublicKey: vi.fn().mockResolvedValue('GTEST_PUBLIC_KEY'),
  signTransaction: vi.fn().mockResolvedValue('signed_xdr'),
  signBlob: vi.fn().mockResolvedValue({ signedBlob: '' }),
  signAuthEntry: vi.fn().mockResolvedValue({ signedAuthEntry: '' }),
  isConnected: vi.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  setAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  getNetwork: vi.fn().mockResolvedValue({ networkUrl: '', network: 'TESTNET' }),
  getNetworkDetails: vi.fn().mockResolvedValue({
    network: 'TESTNET',
    networkUrl: '',
    networkPassphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: '',
  }),
  WatchWalletChanges: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
}));
