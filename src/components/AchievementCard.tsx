"use client";

import { useRef, useState } from "react";

interface Props {
  invoiceId: string;
  totalAmount: string; // pre-formatted, e.g. "1,234.56"
  onDismiss: () => void;
}

export default function AchievementCard({ invoiceId, totalAmount, onDismiss }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const captureCanvas = async () => {
    // TODO: html2canvas not installed - commenting out for now
    // const html2canvas = (await import("html2canvas")).default;
    // const canvas = await html2canvas(cardRef.current!, { useCORS: true, scale: 2 });
    // return canvas;
    return null;
  };

  const handleDownload = async () => {
    // TODO: html2canvas not installed - download feature disabled
    console.warn("Download feature disabled");
  };

  const handleShare = async () => {
    // TODO: html2canvas not installed - share feature disabled
    console.warn("Share feature disabled");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Achievement"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    >
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Card to capture */}
        <div
          ref={cardRef}
          className="rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-6 text-center shadow-2xl"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-1 text-sm font-bold text-white">
            ✅ Fully Funded!
          </div>
          <p className="text-xs text-indigo-300 mb-1 font-mono">Invoice #{invoiceId}</p>
          <p className="text-4xl font-extrabold text-white mt-2">{totalAmount}</p>
          <p className="text-indigo-300 text-sm mt-1">USDC</p>
          <p className="mt-4 text-xs text-indigo-400">Powered by StellarSplit ✦</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {"share" in navigator ? (
            <button
              type="button"
              onClick={handleShare}
              disabled={busy}
              className="flex-1 min-h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {busy ? "Preparing…" : "Share"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 min-h-11 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {busy ? "Preparing…" : "Download"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
