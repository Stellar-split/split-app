"use client";

import { useEffect, useState } from "react";
import FocusTrap from "./FocusTrap";

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

interface Props {
  txHash: string;
  action: string;
  onClose: () => void;
}

export default function TxConfirmModal({ txHash, action, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // Focus trap and Escape handled by FocusTrap

  const handleCopy = async () => {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 id="tx-modal-title" className="text-lg font-semibold text-green-400">
            ✓ {action} confirmed
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-2">Transaction hash</p>
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
          <span className="font-mono text-xs text-gray-200 break-all flex-1">{txHash}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Copy transaction hash"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <a
          href={`${EXPLORER_BASE}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          View on Stellar Expert ↗
        </a>
        </div>
      </FocusTrap>
    </div>
  );
}
