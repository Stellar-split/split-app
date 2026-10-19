"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletContext } from "@/contexts/WalletContext";
import { truncateAddress, formatAmount } from "@stellar-split/sdk";
import { fetchUsdcBalance } from "@/lib/stellar";
import QRModal from "@/components/QRModal";
import WalletErrorModal, { type WalletErrorType } from "@/components/WalletErrorModal";
import { useToast } from "@/contexts/ToastContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

/** Connection status surfaced by the WalletConnect v2 flow. */
type WcStatus =
  | "idle"
  | "awaiting_scan"
  | "connecting"
  | "connected"
  | "retrying"
  | "error";

const WC_STATUS_LABEL: Record<WcStatus, string> = {
  idle: "",
  awaiting_scan: "Waiting for wallet to scan the QR code…",
  connecting: "Connecting to mobile wallet…",
  connected: "Connected",
  retrying: "Connection timed out — retrying…",
  error: "Connection failed",
};

interface Props {
  /** Smaller footprint for the sticky header nav: address badge + single connect button, no balance line. */
  compact?: boolean;
}

function classifyWalletError(e: unknown): WalletErrorType {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("not installed") || msg.includes("freighter is not") || msg.includes("no freighter")) return "not_installed";
  if (msg.includes("locked") || msg.includes("unlock")) return "locked";
  if (msg.includes("reject") || msg.includes("declin") || msg.includes("cancel") || msg.includes("denied")) return "rejected";
  if (msg.includes("network") || msg.includes("passphrase") || msg.includes("mismatch")) return "network_mismatch";
  return "not_installed";
}

/**
 * WalletConnect — Connect via Freighter or WalletConnect.
 * Connection state is sourced from WalletContext, which caches the last
 * connected public key in sessionStorage and silently re-verifies it on
 * mount, so a page refresh reconnects without a new approval popup.
 */
export default function WalletConnect({ compact = false }: Props) {
  const {
    address,
    walletType,
    connecting,
    error,
    freighterInstalled,
    connections,
    connect,
    disconnect,
    switchTo,
  } = useWalletContext();
  const toast = useToast();
  const { setPreferredWalletType } = useUserPreferences();
  const [modalError, setModalError] = useState<WalletErrorType>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUri, setQrUri] = useState<string>("");
  const [wcStatus, setWcStatus] = useState<WcStatus>("idle");
  const [wcError, setWcError] = useState<WalletErrorType>(null);
  const [wcRetryable, setWcRetryable] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

  // Clear any pending retry timer on unmount.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Reflect the context's WalletConnect session status in local UI state.
  useEffect(() => {
    if (walletType !== "walletconnect") return;
    if (address) {
      setWcStatus("connected");
      setWcError(null);
      setWcRetryable(false);
      setQrOpen(false);
    }
  }, [walletType, address]);

  useEffect(() => {
    if (!address || !USDC_CONTRACT_ID) {
      setBalance(null);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);
    fetchUsdcBalance(address, USDC_CONTRACT_ID)
      .then((bal) => {
        if (!cancelled) setBalance(bal);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, USDC_CONTRACT_ID]);

  const handleConnect = async () => {
    setPreferredWalletType("freighter");
    try {
      await connect("freighter");
    } catch (e) {
      // connection state/error is surfaced via context state
      const errType = classifyWalletError(e);
      if (errType === "rejected") {
        toast.error("Connection rejected. Try again when you're ready.");
      } else {
        setRetryAction(() => handleConnect);
        setModalError(errType);
      }
    }
  };

  const handleConnectWalletConnect = async () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setWcError(null);
    setWcRetryable(false);
    setWcStatus("connecting");
    try {
      const result = await connect("walletconnect");
      if (result && "uri" in result && result.uri) {
        setQrUri(result.uri);
        setQrOpen(true);
        setWcStatus("awaiting_scan");
      } else {
        // No pairing URI returned — treat as a failed session start.
        setWcStatus("error");
        setWcError("not_installed");
        setWcRetryable(true);
      }
    } catch (e) {
      const errType = classifyWalletError(e);
      setWcStatus("error");
      setWcError(errType);
      setWcRetryable(true);
      if (errType === "rejected") {
        toast.error("WalletConnect request rejected. Try again when you're ready.");
      } else {
        toast.error("Could not initiate WalletConnect. Please try again.");
      }
      console.error(e);
    }
  };

  const handleWcRetry = () => {
    setWcStatus("retrying");
    setWcError(null);
    setWcRetryable(false);
    // Brief delay so the retrying state is visible before re-initiating.
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      void handleConnectWalletConnect();
    }, 600);
  };

  const handleWcClose = () => {
    setQrOpen(false);
    if (wcStatus === "awaiting_scan" || wcStatus === "connecting") {
      setWcStatus("idle");
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleSwitch = async (target: string) => {
    try {
      await switchTo(target);
      setSelectorOpen(false);
    } catch (e) {
      const errType = classifyWalletError(e);
      setRetryAction(() => () => handleSwitch(target));
      setModalError(errType);
    }
  };

  const handleDisconnectAll = async () => {
    try {
      await Promise.all(connections.map((c) => disconnect(c.address)));
    } catch (e) {
      const errType = classifyWalletError(e);
      setRetryAction(() => handleDisconnectAll);
      setModalError(errType);
    }
  };

  // Connection status indicator — always visible in both compact and full modes.
  const statusColor = connecting
    ? "bg-amber-400"
    : error
    ? "bg-red-500"
    : address
    ? "bg-green-500"
    : "bg-gray-400";
  const statusLabel = connecting
    ? "Connecting…"
    : error
    ? "Connection error"
    : address
    ? truncateAddress(address)
    : "Not connected";

  const statusIndicator = (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label={`Wallet status: ${statusLabel}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`}
        aria-hidden="true"
      />
      <span
        className={`font-mono text-gray-700 dark:text-gray-300 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {statusLabel}
      </span>
    </div>
  );

  // Connected state
  if (address && walletType) {
    return (
      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "flex flex-col gap-2 sm:flex-row sm:items-center"
        }
      >
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setSelectorOpen((o) => !o)}
            className={`min-h-11 inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
            aria-haspopup="listbox"
            aria-expanded={selectorOpen}
            aria-label="Wallet selector"
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`}
              aria-hidden="true"
            />
            {truncateAddress(address)}
            <span className="text-gray-400" aria-hidden="true">
              ▾
            </span>
          </button>
          <button
            onClick={handleDisconnect}
            className={`min-h-11 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors ${
              compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
            }`}
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>

          {selectorOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
              role="listbox"
              aria-label="Connected wallets"
            >
              <ul className="max-h-64 overflow-y-auto py-1">
                {connections.map((c) => {
                  const isActive = c.address === address;
                  return (
                    <li
                      key={c.address}
                      role="option"
                      aria-selected={isActive}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <button
                        onClick={() => handleSwitch(c.address)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-label={`Switch to ${truncateAddress(c.address)}`}
                      >
                        <span className="w-4 text-green-500" aria-hidden="true">
                          {isActive ? "✓" : ""}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-mono text-gray-700 dark:text-gray-300">
                            {truncateAddress(c.address)}
                          </span>
                          <span className="text-xs capitalize text-gray-400">
                            {c.walletType}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        {!isActive && (
                          <button
                            onClick={() => handleSwitch(c.address)}
                            className="rounded px-2 py-1 text-xs text-indigo-500 hover:text-indigo-400"
                            aria-label={`Switch to ${truncateAddress(c.address)}`}
                          >
                            Switch
                          </button>
                        )}
                        <button
                          onClick={() => disconnect(c.address)}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:text-red-400"
                          aria-label={`Disconnect ${truncateAddress(c.address)}`}
                        >
                          Disconnect
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {connections.length > 1 && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                  <button
                    onClick={handleDisconnectAll}
                    className="w-full rounded px-2 py-1.5 text-xs font-semibold text-red-500 hover:text-red-400"
                    aria-label="Disconnect all wallets"
                  >
                    Disconnect all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {!compact && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {balanceLoading
              ? "Loading USDC…"
              : balance !== null
              ? `${formatAmount(balance)} USDC`
              : USDC_CONTRACT_ID
              ? "Unable to load balance"
              : "USDC contract not configured"}
          </div>
        )}
      </div>
    );
  }

  // Freighter not detected — polite install prompt instead of an error.
  if (freighterInstalled === false) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className={compact ? "text-xs text-gray-400" : "text-sm text-gray-400"}>
          Freighter isn&apos;t installed.{" "}
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            Install Freighter
          </a>
        </p>
      </div>
    );
  }

  // Compact disconnected state — single Freighter connect button for the header.
  if (compact) {
    return (
      <div className="flex flex-col items-start gap-1">
        {statusIndicator}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="min-h-11 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect wallet"
        >
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && <p className="text-red-400 text-xs">Could not connect.</p>}
      </div>
    );
  }

  // Disconnected state - show both options
  return (
    <div className="flex flex-col items-start gap-2">
      {statusIndicator}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect with Freighter"
        >
          {connecting ? "Connecting…" : "Connect with Freighter"}
        </button>

        <button
          onClick={handleConnectWalletConnect}
          disabled={connecting || wcStatus === "connecting" || wcStatus === "retrying"}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors disabled:opacity-50 border border-gray-200 dark:border-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect with mobile wallet via WalletConnect"
        >
          {wcStatus === "connecting" || wcStatus === "retrying"
            ? "Connecting…"
            : "Connect with mobile wallet"}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">Could not connect wallet.</p>}

      {wcStatus !== "idle" && wcStatus !== "connected" && (
        <div
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          {(wcStatus === "awaiting_scan" ||
            wcStatus === "connecting" ||
            wcStatus === "retrying") && (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
              aria-hidden="true"
            />
          )}
          <span className={wcStatus === "error" ? "text-red-400" : undefined}>
            {WC_STATUS_LABEL[wcStatus]}
          </span>
          {wcStatus === "error" && wcRetryable && (
            <button
              onClick={handleWcRetry}
              className="min-h-11 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Retry WalletConnect connection"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <QRModal
        open={qrOpen}
        uri={qrUri}
        onClose={handleWcClose}
        onConnected={() => {
          setWcStatus("connected");
          setQrOpen(false);
        }}
      />

      <WalletErrorModal
        errorType={modalError}
        onDismiss={() => {
          setModalError(null);
          setRetryAction(null);
        }}
        onRetry={() => {
          setModalError(null);
          const action = retryAction;
          setRetryAction(null);
          action?.();
        }}
      />

      <WalletErrorModal
        errorType={wcError}
        onDismiss={() => setWcError(null)}
        onRetry={() => {
          setWcError(null);
          handleWcRetry();
        }}
      />
    </div>
  );
}
