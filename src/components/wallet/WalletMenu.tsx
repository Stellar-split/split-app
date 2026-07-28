"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import WalletAddress from "@/components/WalletAddress";
import WalletBalanceDisplay from "@/components/wallet/WalletBalanceDisplay";

interface Props {
  address: string;
  onDisconnect?: () => void;
}

export default function WalletMenu({ address, onDisconnect }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        <WalletAddress address={address} truncate />
        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Wallet Address</div>
            <WalletAddress address={address} truncate={false} showCopy />
          </div>

          <div className="border-t border-gray-700 my-3" />

          <WalletBalanceDisplay address={address} isOpen={isOpen} />

          {onDisconnect && (
            <>
              <div className="border-t border-gray-700 my-3" />
              <button
                onClick={() => {
                  onDisconnect();
                  setIsOpen(false);
                }}
                className="w-full text-left text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
