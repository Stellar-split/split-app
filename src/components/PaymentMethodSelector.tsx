"use client";

import { useEffect, useState } from "react";

type PaymentMethod = "freighter" | "walletconnect";

const STORAGE_KEY_PREFIX = "paymentMethodPref:";

export function getPreferenceKey(payer: string, recipient: string): string {
  return `${STORAGE_KEY_PREFIX}${payer}:${recipient}`;
}

export function loadPreference(payer: string, recipient: string): PaymentMethod | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(getPreferenceKey(payer, recipient));
  if (val === "freighter" || val === "walletconnect") return val;
  return null;
}

export function savePreference(payer: string, recipient: string, method: PaymentMethod): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getPreferenceKey(payer, recipient), method);
}

interface Props {
  onMethodChange: (method: PaymentMethod) => void;
  payerAddress?: string;
  recipientAddress?: string;
}

export default function PaymentMethodSelector({ onMethodChange, payerAddress, recipientAddress }: Props) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("freighter");
  const [walletConnectAvailable, setWalletConnectAvailable] = useState(false);

  useEffect(() => {
    const checkWalletConnect = async () => {
      try {
        setWalletConnectAvailable(true);
      } catch {
        setWalletConnectAvailable(false);
      }
    };
    checkWalletConnect();
  }, []);

  useEffect(() => {
    if (payerAddress && recipientAddress) {
      const saved = loadPreference(payerAddress, recipientAddress);
      if (saved) {
        setSelectedMethod(saved);
        onMethodChange(saved);
        return;
      }
    }
    const globalSaved = localStorage.getItem("preferredWallet") as PaymentMethod | null;
    if (globalSaved && (globalSaved === "freighter" || globalSaved === "walletconnect")) {
      setSelectedMethod(globalSaved);
      onMethodChange(globalSaved);
    }
  }, [onMethodChange, payerAddress, recipientAddress]);

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    localStorage.setItem("preferredWallet", method);
    if (payerAddress && recipientAddress) {
      savePreference(payerAddress, recipientAddress, method);
    }
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
