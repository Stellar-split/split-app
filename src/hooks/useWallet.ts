"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  connectFreighter,
  connectWalletConnect,
  disconnectWalletConnect,
  getFreighterPublicKey,
  getWalletConnectPublicKey,
} from "@/lib/freighter";
import type { WalletType } from "@/lib/freighter";

const STORAGE_KEY = "stellarsplit_wallet";

interface CachedWallet {
  address: string;
  walletType: WalletType;
}

interface WalletState {
  address: string | null;
  walletType: WalletType | null;
  connecting: boolean;
  error: string | null;
  freighterInstalled: boolean | null;
}

function readCache(): CachedWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.address === "string" && typeof parsed?.walletType === "string") {
      return parsed as CachedWallet;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(wallet: CachedWallet | null) {
  if (typeof window === "undefined") return;
  try {
    if (!wallet) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    }
  } catch {
    // sessionStorage unavailable (private mode, etc.) — connection state
    // just won't persist across a refresh.
  }
}

/**
 * Shared Freighter/WalletConnect connection state.
 *
 * Reads any cached public key from sessionStorage synchronously (so the
 * first paint already reflects a previously-granted connection), then
 * silently re-verifies it against the wallet extension before paint via
 * useLayoutEffect — no approval popup when the wallet already granted
 * permission.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    const cached = readCache();
    return {
      address: cached?.address ?? null,
      walletType: cached?.walletType ?? null,
      connecting: false,
      error: null,
      freighterInstalled: null,
    };
  });

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

      if (!cached) return;

      // For Freighter, only skip straight to getPublicKey() (no popup) when
      // isConnected() confirms the extension already granted this origin
      // access. For WalletConnect there's no equivalent probe — fall back
      // to the existing silent getWalletConnectPublicKey() check.
      if (cached.walletType === "freighter" && !freighterConnected) {
        writeCache(null);
        setState((prev) => ({ ...prev, address: null, walletType: null }));
        return;
      }

      try {
        const key =
          cached.walletType === "freighter"
            ? await getFreighterPublicKey()
            : await getWalletConnectPublicKey();

        if (cancelled) return;

        if (key && key === cached.address) {
          setState((prev) => ({ ...prev, address: key, walletType: cached.walletType }));
        } else {
          writeCache(null);
          setState((prev) => ({ ...prev, address: null, walletType: null }));
        }
      } catch {
        if (!cancelled) {
          writeCache(null);
          setState((prev) => ({ ...prev, address: null, walletType: null }));
        }
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (type: WalletType) => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));
    try {
      if (type === "freighter") {
        const address = await connectFreighter();
        writeCache({ address, walletType: "freighter" });
        setState((prev) => ({ ...prev, address, walletType: "freighter", connecting: false }));
        return { address, walletType: "freighter" as WalletType };
      }

      const { publicKey, uri } = await connectWalletConnect();
      writeCache({ address: publicKey, walletType: "walletconnect" });
      setState((prev) => ({ ...prev, address: publicKey, walletType: "walletconnect", connecting: false }));
      return { address: publicKey, walletType: "walletconnect" as WalletType, uri };
    } catch (e) {
      setState((prev) => ({ ...prev, connecting: false, error: String(e) }));
      throw e;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (state.walletType === "walletconnect") {
      await disconnectWalletConnect();
    }
    writeCache(null);
    setState((prev) => ({ ...prev, address: null, walletType: null, error: null }));
  }, [state.walletType]);

  return {
    address: state.address,
    walletType: state.walletType,
    connecting: state.connecting,
    error: state.error,
    freighterInstalled: state.freighterInstalled,
    connect,
    disconnect,
  };
}

export type UseWalletReturn = ReturnType<typeof useWallet>;
