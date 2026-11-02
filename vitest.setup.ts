import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

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

// ---------------------------------------------------------------------------
// Reliability feature test setup (error handling, retry, offline queue)
// ---------------------------------------------------------------------------

// Track online status so tests can simulate connectivity changes.
let onlineStatus = true;

Object.defineProperty(globalThis.navigator, 'onLine', {
  configurable: true,
  get: () => onlineStatus,
});

/**
 * Simulate a connectivity change. Dispatches the appropriate window event so
 * listeners registered by the offline queue / connectivity hooks fire.
 */
export function setOnlineStatus(online: boolean): void {
  onlineStatus = online;
  const event = new Event(online ? 'online' : 'offline');
  globalThis.window?.dispatchEvent(event);
}

(globalThis as any).setOnlineStatus = setOnlineStatus;

// Mock fetch so tests never hit the network. Individual tests can override
// this with vi.mocked(fetch).mockResolvedValueOnce(...) etc.
const fetchMock = vi.fn(async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
);
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  onlineStatus = true;
  fetchMock.mockClear();
});

afterEach(() => {
  onlineStatus = true;
  vi.clearAllMocks();
});

// Mock external ledger dependencies that may not be available
vi.mock('@ledgerhq/hw-transport-webhid', () => ({ default: {} }), { external: true });
vi.mock('@ledgerhq/hw-app-str', () => ({ default: {} }), { external: true });
// Mock missing UI components
const React = require('react');
vi.mock('@/components/ArbitratorPicker', () => ({
  default: () => React.createElement('div', { 'data-testid': 'arbitrator-picker' }),
}));

vi.mock('@/components/FocusTrap', () => ({
  default: ({ children }: any) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/Modal', () => ({
  default: ({ children, isOpen }: any) => isOpen ? React.createElement(React.Fragment, null, children) : null,
}));

vi.mock('@/lib/ipfs', () => ({
  uploadToIpfs: vi.fn().mockResolvedValue('QmMockCID'),
}));
