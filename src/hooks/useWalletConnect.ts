import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './useToast';

export type WalletConnectStatus =
  | 'idle'
  | 'connecting'
  | 'awaiting_scan'
  | 'connected'
  | 'error';

export interface WalletConnectSession {
  topic: string;
  chainId: number;
  accounts: string[];
  expiry: number;
}

export interface SignTransactionParams {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
  chainId?: number;
}

export interface SignTransactionResult {
  hash: string;
  rawTransaction?: string;
}

export interface UseWalletConnectOptions {
  projectId?: string;
  relayUrl?: string;
  chainId?: number;
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  maxRetries?: number;
  baseRetryDelayMs?: number;
  sessionTimeoutMs?: number;
  signTimeoutMs?: number;
}

interface WalletConnectClientLike {
  connect: (options: {
    requiredNamespaces: Record<string, unknown>;
  }) => Promise<{
    uri?: string;
    approval: () => Promise<WalletConnectSession>;
  }>;
  disconnect: (options: {
    topic: string;
    reason: { code: number; message: string };
  }) => Promise<void>;
  request: (options: {
    topic: string;
    chainId: string;
    request: { method: string; params: unknown };
  }) => Promise<unknown>;
}

const DEFAULT_CHAIN_ID = 1;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_RETRY_DELAY_MS = 1000;
const DEFAULT_SESSION_TIMEOUT_MS = 120000;
const DEFAULT_SIGN_TIMEOUT_MS = 60000;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown WalletConnect error';
};

const buildRequiredNamespaces = (chainId: number): Record<string, unknown> => ({
  eip155: {
    methods: ['eth_sendTransaction', 'eth_signTransaction', 'personal_sign'],
    chains: [`eip155:${chainId}`],
    events: ['accountsChanged', 'chainChanged'],
  },
});

export const useWalletConnect = (options: UseWalletConnectOptions = {}) => {
  const {
    projectId,
    relayUrl,
    chainId = DEFAULT_CHAIN_ID,
    metadata,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseRetryDelayMs = DEFAULT_BASE_RETRY_DELAY_MS,
    sessionTimeoutMs = DEFAULT_SESSION_TIMEOUT_MS,
    signTimeoutMs = DEFAULT_SIGN_TIMEOUT_MS,
  } = options;

  const { showToast } = useToast();

  const [status, setStatus] = useState<WalletConnectStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [session, setSession] = useState<WalletConnectSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clientRef = useRef<WalletConnectClientLike | null>(null);
  const mountedRef = useRef(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
    };
  }, []);

  const safeSetStatus = useCallback((next: WalletConnectStatus) => {
    if (mountedRef.current) {
      setStatus(next);
    }
  }, []);

  const safeSetError = useCallback((next: string | null) => {
    if (mountedRef.current) {
      setError(next);
    }
  }, []);

  const safeSetUri = useCallback((next: string | null) => {
    if (mountedRef.current) {
      setUri(next);
    }
  }, []);

  const safeSetSession = useCallback((next: WalletConnectSession | null) => {
    if (mountedRef.current) {
      setSession(next);
    }
  }, []);

  const safeSetAttempt = useCallback((next: number) => {
    if (mountedRef.current) {
      setAttempt(next);
    }
  }, []);

  const getClient = useCallback(async (): Promise<WalletConnectClientLike> => {
    if (clientRef.current) {
      return clientRef.current;
    }

    if (!projectId) {
      throw new Error('WalletConnect projectId is required');
    }

    // Lazy-load the WalletConnect v2 SDK to keep the initial bundle small.
    const moduleName = '@walletconnect/sign-client';
    const sdk = (await import(/* webpackChunkName: "walletconnect" */ moduleName)) as {
      SignClient: {
        init: (config: Record<string, unknown>) => Promise<WalletConnectClientLike>;
      };
    };

    const client = await sdk.SignClient.init({
      projectId,
      relayUrl,
      metadata,
    });

    clientRef.current = client;
    return client;
  }, [projectId, relayUrl, metadata]);

  const cleanupSession = useCallback(async () => {
    const client = clientRef.current;
    const currentSession = session;
    if (client && currentSession) {
      try {
        await client.disconnect({
          topic: currentSession.topic,
          reason: { code: 6000, message: 'User disconnected' },
        });
      } catch {
        // Ignore disconnect errors during cleanup.
      }
    }
    safeSetSession(null);
    safeSetUri(null);
  }, [session, safeSetSession, safeSetUri]);

  const connect = useCallback(async (): Promise<void> => {
    cancelledRef.current = false;
    safeSetError(null);
    safeSetUri(null);
    safeSetSession(null);
    safeSetStatus('connecting');
    safeSetAttempt(0);

    let lastError: unknown = null;

    for (let currentAttempt = 1; currentAttempt <= maxRetries; currentAttempt += 1) {
      if (cancelledRef.current) {
        return;
      }

      safeSetAttempt(currentAttempt);

      try {
        const client = await getClient();

        const { uri: pairingUri, approval } = await client.connect({
          requiredNamespaces: buildRequiredNamespaces(chainId),
        });

        if (cancelledRef.current) {
          return;
        }

        if (pairingUri) {
          safeSetUri(pairingUri);
        }
        safeSetStatus('awaiting_scan');
        showToast({
          type: 'info',
          message: 'Scan the QR code with your mobile wallet to connect.',
        });

        const approvedSession = await withTimeout(
          approval(),
          sessionTimeoutMs,
          'WalletConnect session approval timed out',
        );

        if (cancelledRef.current) {
          return;
        }

        safeSetSession(approvedSession);
        safeSetStatus('connected');
        safeSetError(null);
        showToast({
          type: 'success',
          message: 'Wallet connected successfully.',
        });
        return;
      } catch (err) {
        lastError = err;
        const message = getErrorMessage(err);

        if (cancelledRef.current) {
          return;
        }

        if (currentAttempt < maxRetries) {
          const backoff = baseRetryDelayMs * 2 ** (currentAttempt - 1);
          showToast({
            type: 'warning',
            message: `Connection attempt ${currentAttempt} failed. Retrying in ${Math.round(
              backoff / 1000,
            )}s...`,
          });
          await delay(backoff);
        } else {
          safeSetError(message);
          safeSetStatus('error');
          showToast({
            type: 'error',
            message: `WalletConnect failed after ${maxRetries} attempts: ${message}`,
          });
        }
      }
    }

    if (lastError && !cancelledRef.current) {
      safeSetError(getErrorMessage(lastError));
      safeSetStatus('error');
    }
  }, [
    baseRetryDelayMs,
    chainId,
    getClient,
    maxRetries,
    safeSetAttempt,
    safeSetError,
    safeSetSession,
    safeSetStatus,
    safeSetUri,
    sessionTimeoutMs,
    showToast,
  ]);

  const disconnect = useCallback(async (): Promise<void> => {
    cancelledRef.current = true;
    await cleanupSession();
    safeSetStatus('idle');
    safeSetError(null);
    showToast({
      type: 'info',
      message: 'Wallet disconnected.',
    });
  }, [cleanupSession, safeSetError, safeSetStatus, showToast]);

  const signTransaction = useCallback(
    async (params: SignTransactionParams): Promise<SignTransactionResult> => {
      if (!session) {
        const message = 'No active WalletConnect session';
        safeSetError(message);
        showToast({ type: 'error', message });
        throw new Error(message);
      }

      const client = await getClient();
      const txChainId = params.chainId ?? session.chainId ?? chainId;

      const transaction = {
        from: session.accounts[0],
        to: params.to,
        value: params.value,
        data: params.data,
        gasLimit: params.gasLimit,
        gasPrice: params.gasPrice,
        nonce: params.nonce,
        chainId: txChainId,
      };

      try {
        const result = await withTimeout(
          client.request({
            topic: session.topic,
            chainId: `eip155:${txChainId}`,
            request: {
              method: 'eth_sendTransaction',
              params: [transaction],
            },
          }),
          signTimeoutMs,
          'Wallet signing request timed out',
        );

        const hash = typeof result === 'string' ? result : String(result);
        showToast({
          type: 'success',
          message: 'Transaction signed and submitted.',
        });
        return { hash };
      } catch (err) {
        const message = getErrorMessage(err);
        safeSetError(message);
        showToast({
          type: 'error',
          message: `Transaction signing failed: ${message}`,
        });
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [chainId, getClient, safeSetError, session, showToast, signTimeoutMs],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    safeSetStatus('idle');
    safeSetError(null);
    safeSetUri(null);
    safeSetSession(null);
    safeSetAttempt(0);
  }, [safeSetAttempt, safeSetError, safeSetSession, safeSetStatus, safeSetUri]);

  return {
    status,
    uri,
    session,
    error,
    attempt,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting' || status === 'awaiting_scan',
    connect,
    disconnect,
    signTransaction,
    reset,
  };
};

export default useWalletConnect;