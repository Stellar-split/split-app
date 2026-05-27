"use client";

import { useEffect, useState } from "react";
import {
  connectFreighter,
  getFreighterPublicKey,
  connectWalletConnect,
  getWalletConnectPublicKey,
  disconnectWalletConnect,
  type WalletType,
} from "@/lib/freighter";
import { truncateAddress } from "@stellar-split/sdk";
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

  const handleConnectFreighter = async () => {
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
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <span className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-gray-800 text-sm font-mono text-gray-300 whitespace-nowrap">
          {truncateAddress(address)}
        </span>
        <button
          onClick={handleDisconnect}
          className="min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors whitespace-nowrap"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Disconnected state - show both options
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={handleConnectFreighter}
          disabled={loading}
          className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
          aria-label="Connect with Freighter"
        >
          {loading ? "Connecting…" : "Connect with Freighter"}
        </button>

        <button
          onClick={handleConnectWalletConnect}
          disabled={loading}
          className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
          aria-label="Connect with WalletConnect"
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
