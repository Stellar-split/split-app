"use client";

import { useEffect, useMemo, useState } from "react";
import { connectFreighter, getFreighterPublicKey, getWalletConnectPublicKey, connectWalletConnect, disconnectWalletConnect } from "@/lib/freighter";
import type { WalletType } from "@/lib/freighter";
import { truncateAddress, formatAmount } from "@stellar-split/sdk";
import { fetchUsdcBalance, USDC_CONTRACT_ID } from "@/lib/stellar";
import QRModal from "@/components/QRModal";

/**
 * WalletConnect — Connect via Freighter or WalletConnect
 * Displays truncated address when connected, supports both wallet types
 */
export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

  const loadBalance = async (addr: string) => {
    if (!USDC_CONTRACT_ID) {
      setBalance(null);
      return;
    }

    setBalanceLoading(true);
    try {
      const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";
      if (!usdcAddress) {
        setBalance(null);
        return;
      }
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

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try Freighter first
        const freighterKey = await getFreighterPublicKey();
        if (freighterKey) {
          setAddress(freighterKey);
          setWalletType("freighter");
          return;
        }
      } catch {
        // Freighter not connected
      }

      try {
        // Try WalletConnect
        const wcKey = await getWalletConnectPublicKey();
        if (wcKey) {
          setAddress(wcKey);
          setWalletType("walletconnect");
          return;
        }
      } catch {
        // WalletConnect not connected
      }
    };

    checkConnection();
  }, []);

  useEffect(() => {
    if (!address) return;
    loadBalance(address);
  }, [address]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const pk = await connectFreighter();
      setAddress(pk);
      setWalletType("freighter");
    } catch (e) {
      setError("Could not connect Freighter wallet.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWalletConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { publicKey, uri } = await connectWalletConnect();
      setAddress(publicKey);
      setWalletType("walletconnect");
      setQrUri(uri);
      setQrOpen(true);
    } catch (e) {
      setError("Could not initiate WalletConnect.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (walletType === "walletconnect") {
      await disconnectWalletConnect();
    }
    setAddress(null);
    setWalletType(null);
  };

  // Connected state
  if (address && walletType) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
        <div className="text-sm text-gray-400">
          {balanceLoading
            ? "Loading USDC…"
            : balance !== null
            ? `${formatAmount(balance)} USDC`
            : USDC_CONTRACT_ID
            ? "Unable to load balance"
            : "USDC contract not configured"}
        </div>
      </div>
    );
  }

  // Disconnected state - show both options
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect Wallet via QR"
        >
          {loading ? "Connecting…" : "Connect with Freighter"}
        </button>

        <button
          onClick={handleConnectWalletConnect}
          disabled={loading}
          className="min-h-11 px-6 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 font-semibold transition-colors disabled:opacity-50 border border-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Connect Freighter wallet"
        >
          {loading ? "Connecting…" : "Connect with WalletConnect"}
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
