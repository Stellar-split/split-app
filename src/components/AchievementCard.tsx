"use client";

import { useRef, useState, useEffect } from "react";
import confetti from "canvas-confetti";

export interface NFTDetails {
  tokenId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  txHash?: string;
}

interface Props {
  invoiceId: string;
  totalAmount: string; // pre-formatted, e.g. "1,234.56"
  nftDetails?: NFTDetails;
  onDismiss: () => void;
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

export default function AchievementCard({
  invoiceId,
  totalAmount,
  nftDetails,
  onDismiss,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Confetti is an enhancement, gracefully continue if canvas-confetti fails
    }
  }, []);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2 });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `invoice-${invoiceId}-nft-celebration.png`;
      a.click();
    } catch (err) {
      console.warn("Download image failed", err);
    } finally {
      setBusy(false);
    }
  };

  const getShareUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/invoice/${invoiceId}`
      : `/invoice/${invoiceId}`;

  const handleShare = async () => {
    const shareUrl = getShareUrl();
    const shareText = `Invoice #${invoiceId} settled and released for ${totalAmount} USDC on StellarSplit! ✦ NFT Proof of Settlement minted.`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      setBusy(true);
      try {
        await navigator.share({
          title: `StellarSplit Invoice #${invoiceId} Released`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.warn("Share failed", err);
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      await (navigator as any).clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Copy to clipboard failed", err);
    }
  };

  const nftName = nftDetails?.name || `StellarSplit Settlement #${invoiceId.slice(0, 8)}`;
  const tokenId = nftDetails?.tokenId || `NFT-${invoiceId.slice(0, 6).toUpperCase()}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NFT Celebration & Settlement Proof"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Card to capture and share */}
        <div
          ref={cardRef}
          className="rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-900 border border-indigo-500/40 p-6 text-center shadow-2xl relative overflow-hidden"
        >
          {/* Background decorative glow */}
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Celebration header badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-4 py-1 text-xs font-bold text-emerald-300">
            <span>🎉</span> Invoice Released · NFT Minted!
          </div>

          {/* NFT Card Graphic / Art Box */}
          <div className="mx-auto my-3 w-28 h-28 rounded-2xl bg-gradient-to-tr from-indigo-800 via-indigo-600 to-purple-500 flex flex-col items-center justify-center border-2 border-indigo-400/30 shadow-inner">
            <span className="text-3xl">✦</span>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-100 mt-1">
              Settled NFT
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mt-2">{nftName}</h3>
          <p className="text-xs text-indigo-300 font-mono mt-0.5">Token ID: {tokenId}</p>

          <div className="my-4 py-3 px-4 bg-indigo-900/50 rounded-2xl border border-indigo-700/50">
            <p className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Total Amount Settled</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {totalAmount} <span className="text-sm font-semibold text-indigo-300">USDC</span>
            </p>
          </div>

          {nftDetails?.txHash && (
            <p className="text-xs text-indigo-300 mb-2 font-mono">
              <a
                href={`${STELLAR_EXPERT_BASE}/${nftDetails.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                View Mint Transaction ↗
              </a>
            </p>
          )}

          <p className="text-[11px] text-indigo-400 mt-2 font-medium">
            Permanent Proof of Settlement on Stellar ✦ Powered by StellarSplit
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={busy}
            aria-label="Share NFT celebration"
            className="flex-1 min-h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? "Preparing…" : copied ? "✓ Link Copied!" : "Share NFT"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            aria-label="Download NFT Card"
            className="flex-1 min-h-11 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? "Saving…" : "Download Card"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm transition-colors"
            aria-label="Close celebration screen"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
