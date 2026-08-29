"use client";

import { useWalletBalance } from "@/hooks/useWalletBalance";
import { RotateCw } from "lucide-react";

interface Props {
  address: string | null;
  isOpen?: boolean;
}

function SkeletonText() {
  return <div className="h-4 bg-gray-700 rounded animate-pulse w-24" />;
}

export default function WalletBalanceDisplay({ address, isOpen = true }: Props) {
  const { xlmBalance, usdcBalance, isLoading, isRetrying, refetch } = useWalletBalance(
    address,
    isOpen && !!address
  );

  if (!address) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {isRetrying && (
        <div className="text-xs text-amber-400" role="status">
          Retrying...
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1">XLM Balance</div>
          <div className="font-mono text-sm">
            {isLoading ? <SkeletonText /> : <span>{xlmBalance ?? "0.0"} XLM</span>}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <RotateCw size={16} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1">USDC Balance</div>
          <div className="font-mono text-sm">
            {isLoading ? <SkeletonText /> : <span>{usdcBalance ?? "0.0"} USDC</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
