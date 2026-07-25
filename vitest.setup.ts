import '@testing-library/jest-dom';
import { vi } from 'vitest';

(globalThis as any).jest = vi as any;

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
