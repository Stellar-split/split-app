"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  connectFreighter,
  disconnectWalletConnect,
  getFreighterPublicKey,
  getWalletConnectPublicKey,
} from "@/lib/freighter";
import type { WalletType } from "@/lib/freighter";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import type { WalletConnectStatus } from "@/hooks/useWalletConnect";

const STORAGE_KEY = "stellarsplit_wallet";
const PRIVACY_KEY = "stellarsplit_wallet_persistence";

export interface WalletConnection {
  address: string;
  walletType: WalletType;
  timestamp: number;
}

interface WalletState {
  connections: WalletConnection[];
  activeAddress: string | null;
  activeWalletType: WalletType | null;
  connecting: boolean;
  error: string | null;
  freighterInstalled: boolean | null;
}

/**
 * Whether the user has opted in to persisting their wallet connection across
 * sessions. Defaults to enabled unless explicitly disabled.
 */
function isPersistenceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRIVACY_KEY) !== "disabled";
  } catch {
    return false;
  }
}

function readCache(): CachedWallet | null {
  if (typeof window === "undefined") return null;
  if (!isPersistenceEnabled()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.address === "string" &&
      typeof parsed?.walletType === "string" &&
      typeof parsed?.timestamp === "number"
    ) {
      return parsed as CachedWallet;
    }
    return empty;
  } catch {
    return empty;
  }
}

function writeCache(wallets: PersistedWallets) {
  if (typeof window === "undefined") return;
  try {
    if (!wallet) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else if (isPersistenceEnabled()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — connection state
    // just won't persist across a refresh.
  }
}

function toPersisted(state: WalletState): PersistedWallets {
  return { connections: state.connections, activeAddress: state.activeAddress };
}

function activeType(
  connections: WalletConnection[],
  activeAddress: string | null
): WalletType | null {
  if (!activeAddress) return null;
  return connections.find((c) => c.address === activeAddress)?.walletType ?? null;
}

/**
 * Enable or disable persistence of the wallet connection across sessions.
 * Disabling also clears any stored connection data.
 */
export function setWalletPersistence(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.removeItem(PRIVACY_KEY);
    } else {
      window.localStorage.setItem(PRIVACY_KEY, "disabled");
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

/**
 * Shared Freighter/WalletConnect connection state.
 *
 * Reads the persisted connection list from localStorage synchronously (so
 * the first paint already reflects previously-granted connections), then
 * silently re-verifies each stored connection against its wallet before
 * paint via useLayoutEffect — no approval popup when the wallet already
 * granted permission. Connections that fail verification are dropped.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    const cached = readCache();
    return {
      connections: cached.connections,
      activeAddress: cached.activeAddress,
      activeWalletType: activeType(cached.connections, cached.activeAddress),
      connecting: false,
      error: null,
      freighterInstalled: null,
    };
  });

  const walletConnect = useWalletConnect();
  const verified = useRef(false);

  useLayoutEffect(() => {
    if (verified.current) return;
    verified.current = true;

    let cancelled = false;

    const verify = async () => {
      const cached = readCache();
      let freighterConnected = false;

      try {
        const { isConnected } = await import("@stellar/freighter-api");
        const result = await isConnected();
        if (cancelled) return;
        freighterConnected = result.isConnected === true;
        setState((prev) => ({ ...prev, freighterInstalled: !result.error }));
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, freighterInstalled: null }));
        }
      }

      if (cached.connections.length === 0) return;

      const valid: WalletConnection[] = [];
      for (const connection of cached.connections) {
        // For Freighter, only skip straight to getPublicKey() (no popup) when
        // isConnected() confirms the extension already granted this origin
        // access. For WalletConnect there's no equivalent probe — fall back
        // to the existing silent getWalletConnectPublicKey() check.
        if (connection.walletType === "freighter" && !freighterConnected) continue;

      // For Freighter, only skip straight to getPublicKey() (no popup) when
      // isConnected() confirms the extension already granted this origin
      // access. For WalletConnect there's no equivalent probe — fall back
      // to the existing silent getWalletConnectPublicKey() check.
      if (cached.walletType === "freighter" && !freighterConnected) {
        writeCache(null);
        setState((prev) => ({
          ...prev,
          address: null,
          walletType: null,
          error: "Saved wallet connection could not be restored. Please reconnect.",
        }));
        return;
      }

      if (cancelled) return;

      const activeAddress =
        cached.activeAddress && valid.some((c) => c.address === cached.activeAddress)
          ? cached.activeAddress
          : valid[0]?.address ?? null;

        if (key && key === cached.address) {
          setState((prev) => ({ ...prev, address: key, walletType: cached.walletType }));
        } else {
          writeCache(null);
          setState((prev) => ({
            ...prev,
            address: null,
            walletType: null,
            error: "Saved wallet connection could not be restored. Please reconnect.",
          }));
        }
      } catch {
        if (!cancelled) {
          writeCache(null);
          setState((prev) => ({
            ...prev,
            address: null,
            walletType: null,
            error: "Saved wallet connection could not be restored. Please reconnect.",
          }));
        }
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(
    async (type: WalletType) => {
      setState((prev) => ({ ...prev, connecting: true, error: null }));
      try {
        if (type === "freighter") {
          const address = await connectFreighter();
          writeCache({ address, walletType: "freighter", timestamp: Date.now() });
          setState((prev) => ({ ...prev, address, walletType: "freighter", connecting: false }));
          return { address, walletType: "freighter" as WalletType };
        }

        const { publicKey, uri } = await walletConnect.connect();
        writeCache({ address: publicKey, walletType: "walletconnect", timestamp: Date.now() });
        setState((prev) => ({
          ...prev,
          address: publicKey,
          walletType: "walletconnect",
          connecting: false,
        }));
        return { address: publicKey, walletType: "walletconnect" as WalletType, uri };
      } catch (e) {
        setState((prev) => ({ ...prev, connecting: false, error: String(e) }));
        throw e;
      }
    },
    [walletConnect],
  );

  const disconnect = useCallback(async () => {
    if (state.walletType === "walletconnect") {
      try {
        await walletConnect.disconnect();
      } catch {
        // fall through to the low-level disconnect as a best effort
      }
      await disconnectWalletConnect();
    }
    writeCache(null);
    setState((prev) => ({ ...prev, address: null, walletType: null, error: null }));
  }, [state.walletType, walletConnect]);

  const wcStatus: WalletConnectStatus = walletConnect.status;

  return {
    address: state.activeAddress,
    walletType: state.activeWalletType,
    connections: state.connections,
    activeAddress: state.activeAddress,
    activeWalletType: state.activeWalletType,
    connecting: state.connecting,
    error: state.error,
    freighterInstalled: state.freighterInstalled,
    connect,
    switchTo,
    disconnect,
    // WalletConnect v2 pairing/connection state (#884)
    wcStatus,
    wcUri: walletConnect.uri,
    wcRetrying: walletConnect.retrying,
    wcRetry: walletConnect.retry,
    wcCancel: walletConnect.cancel,
  };
}

export type UseWalletReturn = ReturnType<typeof useWallet>;
