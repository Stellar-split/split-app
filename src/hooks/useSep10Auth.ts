'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Sep10AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

/**
 * Drives the full SEP-0010 challenge → sign → token flow.
 *
 * Call `authenticate(publicKey)` to start the flow.
 * The hook stores the authenticated state and automatically
 * re-initiates the flow on 401 responses via `handleUnauthorized`.
 */
export function useSep10Auth() {
  const [state, setState] = useState<Sep10AuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    error: null,
  });

  const publicKeyRef = useRef<string | null>(null);

  /** Fetch the challenge, sign it with Freighter, exchange for a JWT. */
  const authenticate = useCallback(async (publicKey: string) => {
    publicKeyRef.current = publicKey;
    setState({ isAuthenticated: false, isAuthenticating: true, error: null });

    try {
      // 1. Fetch challenge
      const challengeRes = await fetch(
        `/api/auth/challenge?account=${encodeURIComponent(publicKey)}`
      );
      if (!challengeRes.ok) {
        const err = await challengeRes.json().catch(() => ({ error: 'Challenge fetch failed' }));
        throw new Error((err as { error?: string }).error ?? 'Challenge fetch failed');
      }
      const { transaction, network_passphrase } = (await challengeRes.json()) as {
        transaction: string;
        network_passphrase: string;
      };

      // 2. Sign with Freighter
      const { signTransaction } = await import('@stellar/freighter-api');
      const signResult = await signTransaction(transaction, {
        networkPassphrase: network_passphrase,
      });

      // Freighter returns { signedTxXdr } in newer versions or a plain string in older ones
      const signedXdr =
        typeof signResult === 'string'
          ? signResult
          : (signResult as { signedTxXdr?: string }).signedTxXdr ?? signResult;

      // 3. Exchange for JWT
      const tokenRes = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: signedXdr, account: publicKey }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({ error: 'Token exchange failed' }));
        throw new Error((err as { error?: string }).error ?? 'Token exchange failed');
      }

      setState({ isAuthenticated: true, isAuthenticating: false, error: null });
    } catch (e) {
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  /**
   * Call this when any API response returns 401.
   * Re-initiates SEP-0010 flow automatically if we have a known public key.
   */
  const handleUnauthorized = useCallback(() => {
    const key = publicKeyRef.current;
    if (key) {
      authenticate(key);
    } else {
      setState((prev) => ({ ...prev, isAuthenticated: false }));
    }
  }, [authenticate]);

  return {
    ...state,
    authenticate,
    handleUnauthorized,
  };
}
