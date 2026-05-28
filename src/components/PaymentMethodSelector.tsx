"use client";

import { useEffect, useState } from "react";

interface Props {
  onMethodChange: (method: "freighter" | "walletconnect") => void;
}

export default function PaymentMethodSelector({ onMethodChange }: Props) {
  const [selectedMethod, setSelectedMethod] = useState<"freighter" | "walletconnect">("freighter");
  const [walletConnectAvailable, setWalletConnectAvailable] = useState(false);

  useEffect(() => {
    // Check if WalletConnect is available
    const checkWalletConnect = async () => {
      try {
        // Simple check - in production, would verify actual WalletConnect availability
        setWalletConnectAvailable(true);
      } catch {
        setWalletConnectAvailable(false);
      }
    };
    checkWalletConnect();
  }, []);

  useEffect(() => {
    // Load persisted preference
    const saved = localStorage.getItem("preferredWallet") as "freighter" | "walletconnect" | null;
    if (saved && (saved === "freighter" || saved === "walletconnect")) {
      setSelectedMethod(saved);
      onMethodChange(saved);
    }
  }, [onMethodChange]);

  const handleMethodChange = (method: "freighter" | "walletconnect") => {
    setSelectedMethod(method);
    localStorage.setItem("preferredWallet", method);
    onMethodChange(method);
  };

  return (
    <fieldset className="mb-6 border border-gray-700 rounded-lg p-4">
      <legend className="text-sm font-semibold text-gray-300 mb-3">Payment Method</legend>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="payment-method"
            value="freighter"
            checked={selectedMethod === "freighter"}
            onChange={() => handleMethodChange("freighter")}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-sm text-gray-300">Freighter Wallet</span>
        </label>
        <label className={`flex items-center gap-3 ${!walletConnectAvailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
          <input
            type="radio"
            name="payment-method"
            value="walletconnect"
            checked={selectedMethod === "walletconnect"}
            onChange={() => handleMethodChange("walletconnect")}
            disabled={!walletConnectAvailable}
            className="w-4 h-4 accent-indigo-500 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-gray-300">WalletConnect</span>
          {!walletConnectAvailable && (
            <span className="text-xs text-gray-500 ml-auto" title="WalletConnect is not available">
              Unavailable
            </span>
          )}
        </label>
      </div>
    </fieldset>
  );
}
