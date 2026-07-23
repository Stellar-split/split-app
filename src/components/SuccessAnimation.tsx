"use client";

import { useEffect, useRef } from "react";

interface Props {
  invoiceId: string;
  txHash: string;
  onDismiss: () => void;
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

export default function SuccessAnimation({ invoiceId, txHash, onDismiss }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let confetti: ReturnType<typeof import("canvas-confetti")["create"]> | null = null;

    import("canvas-confetti").then((mod) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      confetti = mod.create(canvas, { resize: true, useWorker: true });
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.55 },
        colors: ["#22c55e", "#4ade80", "#86efac", "#ffffff", "#a3e635"],
      });
    });

    const timer = setTimeout(onDismiss, 3000);
    return () => {
      clearTimeout(timer);
      confetti?.reset();
    };
  }, [onDismiss]);

  const truncated = `${txHash.slice(0, 8)}…${txHash.slice(-6)}`;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 w-full h-full"
        aria-hidden="true"
      />
      <div className="relative z-10 bg-gray-900 border border-green-500/40 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-green-400 mb-1">Payment Confirmed!</h2>
        <p className="text-sm text-gray-400 mb-4">Invoice #{invoiceId}</p>
        <p className="text-xs text-gray-500 font-mono mb-5 break-all">Tx: {truncated}</p>
        <a
          href={`${STELLAR_EXPERT_BASE}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold transition-colors"
        >
          View Transaction
        </a>
      </div>
    </div>
  );
}
