"use client";

import { useEffect, useState } from "react";
import { useWalletContext } from "@/contexts/WalletContext";
import { truncateAddress, formatAmount } from "@stellar-split/sdk";
import { fetchUsdcBalance } from "@/lib/stellar";
import QRModal from "@/components/QRModal";

interface Props {
  /** Smaller footprint for the sticky header nav: address badge + single connect button, no balance line. */
  compact?: boolean;
}

/**
 * WalletConnect — Connect via Freighter or WalletConnect.
 * Connection state is sourced from WalletContext, which caches the last
 * connected public key in sessionStorage and silently re-verifies it on
 * mount, so a page refresh reconnects without a new approval popup.
 */
export default function WalletConnect({ compact = false }: Props) {
  const { address, walletType, connecting, error, freighterInstalled, connect, disconnect } =
    useWalletContext();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUri, setQrUri] = useState<string>("");

  const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }
    if (!USDC_CONTRACT_ID) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, USDC_CONTRACT_ID]);

  const handleConnect = async () => {
    try {
      await connect("freighter");
    } catch {
      // error is surfaced via context state
    }
  };

  const handleConnectWalletConnect = async () => {
    try {
      const result = await connect("walletconnect");
      if (result && "uri" in result && result.uri) {
        setQrUri(result.uri);
        setQrOpen(true);
      }
    } catch {
      // error is surfaced via context state
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // Connected state
  if (address && walletType) {
    return (
      <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center"}>
        <div className="flex items-center gap-2">
          <span
            className={`min-h-11 inline-flex items-center rounded-lg bg-gray-800 font-mono text-gray-300 ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
          >
            {truncateAddress(address)}
          </span>
          <button
            onClick={handleDisconnect}
            className={`min-h-11 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors ${
              compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
            }`}
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
        {!compact && (
          <div className="text-sm text-gray-400">
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
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="min-h-11 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect Freighter wallet"
        >
          {connecting ? "Connecting…" : "Connect with Freighter"}
        </button>

        <button
          onClick={handleConnectWalletConnect}
          disabled={connecting}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 font-semibold transition-colors disabled:opacity-50 border border-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect Wallet via QR"
        >
          {connecting ? "Connecting…" : "Connect with WalletConnect"}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">Could not connect wallet.</p>}

      <QRModal
        open={qrOpen}
        uri={qrUri}
        onClose={() => setQrOpen(false)}
        onConnected={() => setQrOpen(false)}
      />
    </div>
  );
}
