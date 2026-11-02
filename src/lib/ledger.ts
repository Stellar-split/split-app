import { Transaction, Networks } from '@stellar/stellar-sdk';

export type LedgerErrorCode =
  | 'not_connected'
  | 'locked'
  | 'app_not_open'
  | 'denied'
  | 'unsupported'
  | 'unknown';

export class LedgerError extends Error {
  code: LedgerErrorCode;

  constructor(code: LedgerErrorCode, message?: string) {
    super(message ?? defaultMessageForCode(code));
    this.name = 'LedgerError';
    this.code = code;
  }
}

function defaultMessageForCode(code: LedgerErrorCode): string {
  switch (code) {
    case 'not_connected':
      return 'No Ledger device is connected.';
    case 'locked':
      return 'The Ledger device is locked. Please unlock it and try again.';
    case 'app_not_open':
      return 'The Stellar app is not open on the Ledger device.';
    case 'denied':
      return 'The transaction was rejected on the Ledger device.';
    case 'unsupported':
      return 'Ledger devices are not supported in this environment.';
    case 'unknown':
    default:
      return 'An unknown Ledger error occurred.';
  }
}

export interface DerivationPath {
  /** Human readable label, e.g. "Ledger 1". */
  label: string;
  /** BIP32 derivation path, e.g. "44'/148'/0'". */
  path: string;
}

export interface LedgerStatus {
  connected: boolean;
  locked: boolean;
  appOpen: boolean;
  /** Currently selected derivation path, if any. */
  path: string | null;
  /** Public key for the selected path, if available. */
  publicKey: string | null;
  error: LedgerErrorCode | null;
}

export interface SignResult {
  /** Base64-encoded signed transaction envelope XDR. */
  signedXdr: string;
  /** Public key that signed the transaction. */
  publicKey: string;
}

const DEFAULT_DERIVATION_PATHS: DerivationPath[] = [
  { label: 'Ledger 1', path: "44'/148'/0'" },
  { label: 'Ledger 2', path: "44'/148'/1'" },
  { label: 'Ledger 3', path: "44'/148'/2'" },
  { label: 'Ledger 4', path: "44'/148'/3'" },
  { label: 'Ledger 5', path: "44'/148'/4'" },
];

// Minimal structural types for the dynamically imported Ledger modules so we
// don't need to depend on their type packages at build time.
interface StrTransport {
  close(): Promise<void>;
}

interface StrApp {
  getPublicKey(
    path: string,
    display?: boolean,
    verify?: boolean
  ): Promise<{ publicKey: string }>;
  signTransaction(
    path: string,
    rawTxHex: string
  ): Promise<{ signature: string }>;
}

interface TransportWebHIDStatic {
  create(): Promise<StrTransport>;
  list?(): Promise<unknown[]>;
}

interface StrAppStatic {
  new (transport: StrTransport): StrApp;
}

interface LedgerState {
  transport: StrTransport | null;
  app: StrApp | null;
  selectedPath: string | null;
  publicKey: string | null;
  status: LedgerStatus;
}

const state: LedgerState = {
  transport: null,
  app: null,
  selectedPath: null,
  publicKey: null,
  status: {
    connected: false,
    locked: false,
    appOpen: false,
    path: null,
    publicKey: null,
    error: null,
  },
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function mapLedgerError(err: unknown): LedgerError {
  if (err instanceof LedgerError) {
    return err;
  }

  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = message.toLowerCase();

  // Ledger status codes / messages commonly surfaced by hw-app-str and
  // transport-webhid.
  if (
    lower.includes('no device') ||
    lower.includes('no device selected') ||
    lower.includes('cannot open device') ||
    lower.includes('disconnected') ||
    lower.includes('not found') ||
    lower.includes('failed to open the device')
  ) {
    return new LedgerError('not_connected', message || undefined);
  }

  if (
    lower.includes('locked') ||
    lower.includes('0x5515') ||
    lower.includes('device is locked')
  ) {
    return new LedgerError('locked', message || undefined);
  }

  if (
    lower.includes('app') &&
    (lower.includes('not open') ||
      lower.includes('not running') ||
      lower.includes('0x6e01') ||
      lower.includes('0x6511') ||
      lower.includes('0x6d00'))
  ) {
    return new LedgerError('app_not_open', message || undefined);
  }

  if (
    lower.includes('denied') ||
    lower.includes('rejected') ||
    lower.includes('0x6985') ||
    lower.includes('user refused') ||
    lower.includes('cancel')
  ) {
    return new LedgerError('denied', message || undefined);
  }

  return new LedgerError('unknown', message || undefined);
}

async function loadTransport(): Promise<TransportWebHIDStatic> {
  try {
    // Use require to avoid vite static analysis during tests
    const mod = require('@ledgerhq/hw-transport-webhid');
    const TransportWebHID =
      (mod as unknown as { default?: TransportWebHIDStatic }).default ??
      (mod as unknown as TransportWebHIDStatic);
    return TransportWebHID;
  } catch {
    return {} as TransportWebHIDStatic;
  }
}

async function loadStrApp(): Promise<StrAppStatic> {
  try {
    const mod = require('@ledgerhq/hw-app-str');
    const Str =
      (mod as unknown as { default?: StrAppStatic }).default ??
      (mod as unknown as StrAppStatic);
    return Str;
  } catch {
    return {} as StrAppStatic;
  }
}

function updateStatus(partial: Partial<LedgerStatus>): void {
  state.status = { ...state.status, ...partial };
}

/**
 * Connect to a Ledger device and open the Stellar app.
 * Throws a typed LedgerError on failure.
 */
export async function connectLedger(): Promise<LedgerStatus> {
  if (!isBrowser()) {
    const error = new LedgerError('unsupported');
    updateStatus({ connected: false, error: error.code });
    throw error;
  }

  // If already connected, return current status.
  if (state.transport && state.app) {
    return getLedgerStatus();
  }

  try {
    const TransportWebHID = await loadTransport();
    const Str = await loadStrApp();

    const transport = await TransportWebHID.create();
    const app = new Str(transport);

    state.transport = transport;
    state.app = app;

    // Verify the Stellar app is open by requesting the public key for the
    // currently selected (or default) path without on-device display.
    const path = state.selectedPath ?? DEFAULT_DERIVATION_PATHS[0].path;
    const { publicKey } = await app.getPublicKey(path, false, false);

    state.selectedPath = path;
    state.publicKey = publicKey;

    updateStatus({
      connected: true,
      locked: false,
      appOpen: true,
      path,
      publicKey,
      error: null,
    });

    return getLedgerStatus();
  } catch (err) {
    const ledgerError = mapLedgerError(err);
    state.transport = null;
    state.app = null;
    state.publicKey = null;

    updateStatus({
      connected: false,
      locked: ledgerError.code === 'locked',
      appOpen: false,
      publicKey: null,
      error: ledgerError.code,
    });

    throw ledgerError;
  }
}

/**
 * Disconnect from the Ledger device and release the transport.
 */
export async function disconnectLedger(): Promise<void> {
  const transport = state.transport;
  state.transport = null;
  state.app = null;
  state.publicKey = null;

  updateStatus({
    connected: false,
    locked: false,
    appOpen: false,
    publicKey: null,
    error: null,
  });

  if (transport) {
    try {
      await transport.close();
    } catch {
      // Ignore errors while closing; the device may already be gone.
    }
  }
}

/**
 * Return the current Ledger connection status.
 */
export function getLedgerStatus(): LedgerStatus {
  return { ...state.status };
}

/**
 * List the available derivation paths for the Stellar app.
 */
export function listDerivationPaths(): DerivationPath[] {
  return DEFAULT_DERIVATION_PATHS.map((p) => ({ ...p }));
}

/**
 * Select a derivation path and (if connected) fetch the corresponding
 * public key from the device.
 */
export async function selectDerivationPath(path: string): Promise<LedgerStatus> {
  const known = DEFAULT_DERIVATION_PATHS.some((p) => p.path === path);
  if (!known) {
    throw new LedgerError('unknown', `Unknown derivation path: ${path}`);
  }

  state.selectedPath = path;
  updateStatus({ path });

  if (!state.app) {
    return getLedgerStatus();
  }

  try {
    const { publicKey } = await state.app.getPublicKey(path, false, false);
    state.publicKey = publicKey;
    updateStatus({ publicKey, error: null });
    return getLedgerStatus();
  } catch (err) {
    const ledgerError = mapLedgerError(err);
    updateStatus({ error: ledgerError.code });
    throw ledgerError;
  }
}

/**
 * Sign a transaction XDR using the Ledger device. The transaction is displayed
 * on-device for verification before the user confirms signing.
 *
 * @param xdr Base64-encoded transaction envelope XDR.
 * @param path Optional derivation path; defaults to the selected path.
 */
export async function signWithLedger(
  xdr: string,
  path?: string
): Promise<SignResult> {
  if (!isBrowser()) {
    throw new LedgerError('unsupported');
  }

  if (!state.app || !state.transport) {
    throw new LedgerError('not_connected');
  }

  const derivationPath = path ?? state.selectedPath;
  if (!derivationPath) {
    throw new LedgerError('not_connected', 'No derivation path selected.');
  }

  try {
    // Ensure we have the public key for the signing path.
    let publicKey = state.publicKey;
    if (!publicKey || derivationPath !== state.selectedPath) {
      const res = await state.app.getPublicKey(derivationPath, false, false);
      publicKey = res.publicKey;
      state.publicKey = publicKey;
      state.selectedPath = derivationPath;
      updateStatus({ publicKey, path: derivationPath });
    }

    // Parse the transaction so we can display it on-device. The Stellar app
    // shows the transaction details for the user to verify before signing.
    const transaction = new Transaction(xdr, {
      networkPassphrase: Networks.PUBLIC,
    });

    // The Stellar app expects the raw transaction envelope as hex. Using the
    // unsigned envelope ensures the device displays and signs the intended
    // transaction.
    const rawTxHex = transaction
      .toEnvelope()
      .toXDR()
      .toString('hex');

    const { signature } = await state.app.signTransaction(
      derivationPath,
      rawTxHex
    );

    // Attach the signature returned by the device to the transaction.
    transaction.addSignature(publicKey, signature);

    const signedXdr = transaction.toEnvelope().toXDR('base64');

    updateStatus({ error: null });

    return { signedXdr, publicKey };
  } catch (err) {
    const ledgerError = mapLedgerError(err);
    updateStatus({ error: ledgerError.code });
    throw ledgerError;
  }
}