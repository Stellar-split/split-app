"use client";

import { useEffect, useMemo, useState } from "react";
import { connectFreighter, getFreighterPublicKey } from "@/lib/freighter";
import { truncateAddress } from "@stellar-split/sdk";
import { fetchUsdcBalance } from "@/lib/stellar";
import QRModal from "@/components/QRModal";

/**
 * WalletConnect — Freighter connect/disconnect button.
 * Shows truncated address and USDC balance when connected.
 */
export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadBalance = async (addr: string) => {
    setBalanceLoading(true);
    try {
      const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";
      const bal = await fetchUsdcBalance(addr, usdcAddress);
      setBalance(bal);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const [qrOpen, setQrOpen] = useState(false);
  const [qrUri, setQrUri] = useState<string>("");

  // Best-effort placeholder. Replace with real WalletConnect URI when
  // the SDK/flow provides it.
  const walletUri = useMemo(() => {
    return address
      ? `stellar-freighter:connect?publicKey=${encodeURIComponent(address)}`
      : `stellar-freighter:connect?origin=split-app&ts=${Date.now()}`;
  }, [address]);

  useEffect(() => {
    if (!qrOpen) return;
    setQrUri(walletUri);
  }, [qrOpen, walletUri]);

  useEffect(() => {
    // Keep existing connected state in sync.
    getFreighterPublicKey()
      .then((pk) => setAddress(pk))
      .catch(() => null);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const pk = await connectFreighter();
      setAddress(pk);
      // Auto-close the QR modal on successful connection.
      setQrOpen(false);
    } catch (e) {
      setError("Could not connect wallet.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setBalance(null);
  };

  // Re-fetch balance after a successful payment
  useEffect(() => {
    if (!address) return;
    const handler = () => loadBalance(address);
    window.addEventListener("usdc-balance-refresh", handler);
    return () => window.removeEventListener("usdc-balance-refresh", handler);
  }, [address]);

  const handleWalletConnectOption = () => {
    // Open QR modal with an encoded URI. If the app has not connected yet,
    // we still show a placeholder URI and rely on the user completing
    // connection via the modal; on successful connect we auto-close.
    setQrUri(`stellar-freighter:connect?origin=split-app&ts=${Date.now()}`);
    setQrOpen(true);
  };

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-gray-800 text-sm font-mono text-gray-300">
          {truncateAddress(address)}
        </span>
        <button
          onClick={handleDisconnect}
          className="min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleWalletConnectOption}
          disabled={loading}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50"
          aria-label="Connect Wallet via QR"
        >
          WalletConnect
        </button>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 font-semibold transition-colors disabled:opacity-50 border border-gray-800"
          aria-label="Connect Freighter wallet"
        >
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <QRModal
        open={qrOpen}
        uri={qrUri}
        onClose={() => setQrOpen(false)}
        onConnected={() => setQrOpen(false)}
      />
    </div>
  );
}
