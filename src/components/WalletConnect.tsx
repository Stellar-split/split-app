"use client";

import { useState } from "react";
import { connectFreighter, getFreighterPublicKey } from "@/lib/freighter";
import { truncateAddress } from "@stellar-split/sdk";

/**
 * WalletConnect — Freighter connect/disconnect button.
 * Shows truncated address when connected.
 */
export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const pk = await connectFreighter();
      setAddress(pk);
    } catch (e) {
      setError("Could not connect wallet.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => setAddress(null);

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-sm font-mono text-gray-700 dark:text-gray-300">
          {truncateAddress(address)}
        </span>
        <button
          onClick={handleDisconnect}
          className="px-3 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-sm transition-colors text-gray-800 dark:text-gray-100"
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
        className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 text-gray-800 dark:text-gray-100"
        aria-label="Connect Freighter wallet"
      >
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
    </div>
  );
}
