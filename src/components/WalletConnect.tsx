"use client";

import { useEffect, useState } from "react";
import { connectFreighter, getFreighterPublicKey } from "@/lib/freighter";
import { fetchUsdcBalance } from "@/lib/stellar";
import { truncateAddress, formatAmount } from "@stellar-split/sdk";

const USDC_CONTRACT_ID =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ??
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"; // testnet USDC

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
      const bal = await fetchUsdcBalance(addr, USDC_CONTRACT_ID);
      setBalance(bal);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const pk = await connectFreighter();
      setAddress(pk);
      await loadBalance(pk);
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

  if (address) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col items-end min-w-0">
          <span className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm font-mono text-gray-300 truncate max-w-[160px] sm:max-w-none">
            {truncateAddress(address)}
          </span>
          <span
            className="text-xs text-indigo-300 mt-0.5 px-3"
            aria-label="USDC balance"
            aria-live="polite"
          >
            {balanceLoading
              ? "Loading…"
              : balance !== null
              ? `${formatAmount(balance)} USDC`
              : "—"}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50"
        aria-label="Connect Freighter wallet"
      >
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
