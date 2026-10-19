"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet, type UseWalletReturn } from "@/hooks/useWallet";
import { useSep10Auth, type Sep10AuthState } from "@/hooks/useSep10Auth";
import { useWalletConnect, type UseWalletConnectReturn } from "@/hooks/useWalletConnect";
import {
  useWalletPersistence,
  type UseWalletPersistenceReturn,
} from "@/hooks/useWalletPersistence";

export type ReconnectionStatus =
  | "idle"
  | "restoring"
  | "reconnecting"
  | "connected"
  | "failed";

export type WalletContextValue = UseWalletReturn & {
  sep10: Sep10AuthState & {
    authenticate: (publicKey: string) => Promise<void>;
    handleUnauthorized: () => void;
  };
  walletConnect: UseWalletConnectReturn;
  persistence: UseWalletPersistenceReturn;
  /** Status of the auto-reconnection attempt on page load. */
  reconnectionStatus: ReconnectionStatus;
  /** True once a persisted connection has been resolved (success or failure). */
  reconnectionSettled: boolean;
  /** Manually disconnect the wallet and clear persisted connection data. */
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const sep10 = useSep10Auth();
  const walletConnect = useWalletConnect();
  const persistence = useWalletPersistence();

  const [reconnectionStatus, setReconnectionStatus] =
    useState<ReconnectionStatus>("idle");
  const [reconnectionSettled, setReconnectionSettled] = useState(false);
  const reconnectAttempted = useRef(false);

  // Auto-reconnect from persisted state on mount (#888).
  useEffect(() => {
    if (reconnectAttempted.current) return;
    reconnectAttempted.current = true;

    let cancelled = false;

    const restore = async () => {
      const saved = persistence.load();
      if (!saved) {
        if (!cancelled) {
          setReconnectionStatus("idle");
          setReconnectionSettled(true);
        }
        return;
      }

      setReconnectionStatus("restoring");

      try {
        setReconnectionStatus("reconnecting");
        const restored = await persistence.reconnect(saved);
        if (cancelled) return;

        if (restored) {
          setReconnectionStatus("connected");
        } else {
          setReconnectionStatus("failed");
          persistence.clear();
        }
      } catch {
        if (cancelled) return;
        setReconnectionStatus("failed");
        persistence.clear();
      } finally {
        if (!cancelled) setReconnectionSettled(true);
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [persistence]);

  // Persist connection data whenever a verified address becomes available (#888).
  useEffect(() => {
    if (wallet.address && wallet.isConnected) {
      persistence.save({
        address: wallet.address,
        walletId: wallet.walletId,
        connector: walletConnect.isConnected ? "walletconnect" : "injected",
      });
    }
  }, [
    wallet.address,
    wallet.isConnected,
    wallet.walletId,
    walletConnect.isConnected,
    persistence,
  ]);

  // Auto-authenticate only after a verified address is available. When a
  // persisted connection is being restored, wait until it settles so SEP-10
  // runs against the restored (verified) address (#884, #888).
  useEffect(() => {
    if (!reconnectionSettled) return;
    if (wallet.address && !sep10.isAuthenticated && !sep10.isAuthenticating) {
      sep10.authenticate(wallet.address);
    }
  }, [
    reconnectionSettled,
    wallet.address,
    sep10.isAuthenticated,
    sep10.isAuthenticating,
    sep10.authenticate,
  ]);

  const disconnect = useCallback(async () => {
    try {
      if (walletConnect.isConnected) {
        await walletConnect.disconnect();
      }
      await wallet.disconnect();
    } finally {
      persistence.clear();
      setReconnectionStatus("idle");
    }
  }, [walletConnect, wallet, persistence]);

  const value: WalletContextValue = {
    ...wallet,
    sep10,
    walletConnect,
    persistence,
    reconnectionStatus,
    reconnectionSettled,
    disconnect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Access shared wallet connection state. Must be used within <WalletProvider>. */
export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return ctx;
}
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
