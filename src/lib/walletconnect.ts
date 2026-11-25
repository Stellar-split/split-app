import { Core } from '@walletconnect/core';
import { Web3Wallet, IWeb3Wallet } from '@walletconnect/web3wallet';
import { getSdkError } from '@walletconnect/utils';
import type { SessionTypes } from '@walletconnect/types';

/**
 * WalletConnect v2 service module.
 *
 * Wraps @walletconnect/core and @walletconnect/web3wallet to provide:
 *  - pairing proposal creation (returns a URI for QR display)
 *  - session approval / management / persistence
 *  - signing request handling for Stellar transactions
 *  - timeout + retry wrappers around proposals and signing
 *  - an event emitter for connection status
 */

export type WalletConnectStatus =
  | 'idle'
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'signing'
  | 'disconnected'
  | 'error';

export interface WalletConnectStatusEvent {
  status: WalletConnectStatus;
  message?: string;
  error?: Error;
  topic?: string;
  publicKey?: string;
}

export interface ConnectResult {
  uri: string;
  publicKey: string;
}

export interface SignResult {
  signedXdr: string;
  publicKey: string;
}

export interface WalletConnectOptions {
  projectId: string;
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  /** Timeout in ms for session proposals. Defaults to 120000 (2 min). */
  proposalTimeoutMs?: number;
  /** Timeout in ms for signing requests. Defaults to 120000 (2 min). */
  signTimeoutMs?: number;
  /** Number of retry attempts for proposals/signing. Defaults to 2. */
  maxRetries?: number;
  /** Base delay in ms between retries (exponential backoff). Defaults to 1000. */
  retryDelayMs?: number;
}

const STELLAR_CHAIN = 'stellar:pubnet';
const STELLAR_METHODS = ['stellar_signXDR', 'stellar_signAndSubmitXDR'];
const STELLAR_EVENTS = ['accountsChanged'];

const DEFAULT_METADATA = {
  name: 'Stellar WalletConnect',
  description: 'WalletConnect v2 integration for Stellar mobile wallets',
  url: 'https://stellar.org',
  icons: ['https://stellar.org/favicon.ico'],
};

type StatusListener = (event: WalletConnectStatusEvent) => void;

class WalletConnectEmitter {
  private listeners: Set<StatusListener> = new Set();

  on(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  off(listener: StatusListener): void {
    this.listeners.delete(listener);
  }

  emit(event: WalletConnectStatusEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Listener errors must not break the emitter.
      }
    });
  }
}

export const walletConnectEvents = new WalletConnectEmitter();

let web3wallet: IWeb3Wallet | null = null;
let options: WalletConnectOptions | null = null;
let currentStatus: WalletConnectStatus = 'idle';
let activeTopic: string | null = null;
let activePublicKey: string | null = null;
let initPromise: Promise<IWeb3Wallet> | null = null;

function setStatus(
  status: WalletConnectStatus,
  extra: Omit<WalletConnectStatusEvent, 'status'> = {},
): void {
  currentStatus = status;
  walletConnectEvents.emit({ status, ...extra });
}

export function getWalletConnectStatus(): WalletConnectStatus {
  return currentStatus;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
  label: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await delay(retryDelayMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

function extractPublicKey(session: SessionTypes.Struct): string | null {
  const namespaces = session.namespaces ?? {};
  for (const key of Object.keys(namespaces)) {
    const accounts = namespaces[key]?.accounts ?? [];
    for (const account of accounts) {
      // Format: stellar:pubnet:G...
      const parts = account.split(':');
      const address = parts[parts.length - 1];
      if (address && address.startsWith('G')) {
        return address;
      }
    }
  }
  return null;
}

function findSessionByTopic(topic: string): SessionTypes.Struct | null {
  if (!web3wallet) return null;
  const sessions = web3wallet.getActiveSessions();
  return sessions[topic] ?? null;
}

function getActiveSession(): SessionTypes.Struct | null {
  if (!web3wallet) return null;
  const sessions = web3wallet.getActiveSessions();
  const topics = Object.keys(sessions);
  if (topics.length === 0) return null;

  if (activeTopic && sessions[activeTopic]) {
    return sessions[activeTopic];
  }

  // Fall back to the most recently created session.
  const sorted = topics
    .map((topic) => sessions[topic])
    .sort((a, b) => (b.expiry ?? 0) - (a.expiry ?? 0));
  return sorted[0] ?? null;
}

/**
 * Initialize the WalletConnect v2 client. Safe to call multiple times; the
 * underlying client is created once and reused.
 */
export async function initWalletConnect(opts: WalletConnectOptions): Promise<IWeb3Wallet> {
  if (web3wallet) {
    return web3wallet;
  }
  if (initPromise) {
    return initPromise;
  }

  options = {
    proposalTimeoutMs: 120000,
    signTimeoutMs: 120000,
    maxRetries: 2,
    retryDelayMs: 1000,
    ...opts,
  };

  setStatus('initializing');

  initPromise = (async () => {
    try {
      const core = new Core({ projectId: options!.projectId });
      const client = await Web3Wallet.init({
        core,
        metadata: options!.metadata ?? DEFAULT_METADATA,
      });

      client.on('session_proposal', async (proposal) => {
        try {
          const requiredNamespaces = proposal.params.requiredNamespaces ?? {};
          const stellarRequired = requiredNamespaces[STELLAR_CHAIN];

          if (!stellarRequired) {
            await client.rejectSession({
              id: proposal.id,
              reason: getSdkError('UNSUPPORTED_CHAINS'),
            });
            setStatus('error', {
              message: 'Unsupported chain in session proposal',
            });
            return;
          }

          const publicKey = activePublicKey;
          if (!publicKey) {
            await client.rejectSession({
              id: proposal.id,
              reason: getSdkError('USER_REJECTED'),
            });
            setStatus('error', {
              message: 'No public key available to approve session',
            });
            return;
          }

          const namespaces = {
            [STELLAR_CHAIN]: {
              accounts: [`${STELLAR_CHAIN}:${publicKey}`],
              methods: STELLAR_METHODS,
              events: STELLAR_EVENTS,
            },
          };

          const session = await client.approveSession({
            id: proposal.id,
            namespaces,
          });

          activeTopic = session.topic;
          setStatus('connected', {
            topic: session.topic,
            publicKey,
          });
        } catch (error) {
          setStatus('error', {
            message: 'Failed to handle session proposal',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

      client.on('session_request', async (event) => {
        const { topic, params, id } = event;
        const { request } = params;

        try {
          const session = findSessionByTopic(topic);
          if (!session) {
            await client.respondSessionRequest({
              topic,
              response: {
                id,
                jsonrpc: '2.0',
                error: getSdkError('SESSION_SETTLEMENT_FAILED'),
              },
            });
            return;
          }

          if (request.method === 'stellar_signXDR' || request.method === 'stellar_signAndSubmitXDR') {
            // Signing is handled by the dApp side via signWithWalletConnect.
            // Mobile wallets respond through their own handler; here we simply
            // acknowledge unsupported inbound signing requests.
            await client.respondSessionRequest({
              topic,
              response: {
                id,
                jsonrpc: '2.0',
                error: getSdkError('UNSUPPORTED_METHODS'),
              },
            });
            return;
          }

          await client.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              error: getSdkError('UNSUPPORTED_METHODS'),
            },
          });
        } catch (error) {
          setStatus('error', {
            message: 'Failed to handle session request',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

      client.on('session_delete', (event) => {
        if (activeTopic === event.topic) {
          activeTopic = null;
          activePublicKey = null;
        }
        setStatus('disconnected', { topic: event.topic });
      });

      web3wallet = client;
      setStatus('idle');
      return client;
    } catch (error) {
      initPromise = null;
      setStatus('error', {
        message: 'Failed to initialize WalletConnect',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Create a pairing proposal and return the URI for QR display along with the
 * public key that will be used to approve the session.
 *
 * The public key is provided by the caller (the wallet account that will sign).
 */
export async function connectWalletConnect(
  publicKey: string,
  opts?: Partial<WalletConnectOptions>,
): Promise<ConnectResult> {
  if (!publicKey || !publicKey.startsWith('G')) {
    throw new Error('A valid Stellar public key is required to connect');
  }

  if (!web3wallet) {
    if (!opts?.projectId && !options?.projectId) {
      throw new Error('WalletConnect projectId is required');
    }
    await initWalletConnect({
      projectId: opts?.projectId ?? options!.projectId,
      ...options,
      ...opts,
    } as WalletConnectOptions);
  }

  const client = web3wallet!;
  const proposalTimeoutMs = options?.proposalTimeoutMs ?? 120000;
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 1000;

  activePublicKey = publicKey;
  setStatus('connecting', { publicKey });

  const uri = await withRetry(
    async () => {
      const { uri: pairingUri } = await withTimeout(
        client.pair({
          uri: undefined as unknown as string,
        }).catch(() => {
          // pair() with undefined uri is not supported; use core pairing below.
          throw new Error('pairing requires a uri');
        }),
        proposalTimeoutMs,
        'Session proposal',
      );
      return pairingUri;
    },
    0,
    retryDelayMs,
    'Session proposal',
  ).catch(async () => {
    // Fallback: create a pairing topic directly via the core client.
    const core = (client as unknown as { core: { pairing: { create: () => Promise<{ uri: string }> } } }).core;
    const pairing = await withRetry(
      () => withTimeout(core.pairing.create(), proposalTimeoutMs, 'Pairing creation'),
      maxRetries,
      retryDelayMs,
      'Pairing creation',
    );
    return pairing.uri;
  });

  return { uri, publicKey };
}

/**
 * Return the public key associated with the active WalletConnect session.
 */
export function getWalletConnectPublicKey(): string | null {
  if (activePublicKey) {
    return activePublicKey;
  }
  const session = getActiveSession();
  if (!session) {
    return null;
  }
  const publicKey = extractPublicKey(session);
  if (publicKey) {
    activePublicKey = publicKey;
    activeTopic = session.topic;
  }
  return publicKey;
}

/**
 * Send a signing request for a Stellar transaction XDR to the connected mobile
 * wallet and return the signed XDR.
 */
export async function signWithWalletConnect(xdr: string): Promise<SignResult> {
  if (!web3wallet) {
    throw new Error('WalletConnect is not initialized');
  }
  if (!xdr) {
    throw new Error('An XDR string is required to sign');
  }

  const session = getActiveSession();
  if (!session) {
    throw new Error('No active WalletConnect session');
  }

  const publicKey = extractPublicKey(session) ?? activePublicKey;
  if (!publicKey) {
    throw new Error('Unable to determine public key for active session');
  }

  const client = web3wallet;
  const signTimeoutMs = options?.signTimeoutMs ?? 120000;
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 1000;

  setStatus('signing', { topic: session.topic, publicKey });

  try {
    const signedXdr = await withRetry(
      async () => {
        const response = await withTimeout(
          client.request({
            topic: session.topic,
            chainId: STELLAR_CHAIN,
            request: {
              method: 'stellar_signXDR',
              params: { xdr },
            },
          }),
          signTimeoutMs,
          'Signing request',
        );

        const result = response as { signedXDR?: string; signedXdr?: string };
        const signed = result.signedXDR ?? result.signedXdr;
        if (!signed) {
          throw new Error('Wallet did not return a signed XDR');
        }
        return signed;
      },
      maxRetries,
      retryDelayMs,
      'Signing request',
    );

    setStatus('connected', { topic: session.topic, publicKey });
    return { signedXdr, publicKey };
  } catch (error) {
    setStatus('error', {
      message: 'Signing failed',
      error: error instanceof Error ? error : new Error(String(error)),
      topic: session.topic,
      publicKey,
    });
    throw error;
  }
}

/**
 * Disconnect the active WalletConnect session (if any) and reset local state.
 */
export async function disconnectWalletConnect(): Promise<void> {
  const client = web3wallet;
  const session = getActiveSession();

  if (client && session) {
    try {
      await client.disconnectSession({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });
    } catch {
      // Ignore disconnect errors; local state is reset regardless.
    }
  }

  activeTopic = null;
  activePublicKey = null;
  setStatus('disconnected');
}

export default {
  initWalletConnect,
  connectWalletConnect,
  getWalletConnectPublicKey,
  signWithWalletConnect,
  disconnectWalletConnect,
  getWalletConnectStatus,
  walletConnectEvents,
};