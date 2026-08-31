"use client";

import { useRef, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";

interface VerifiedProof {
  payer: string;
  amount: bigint;
  ledger: number;
  imageUrl?: string;
}

interface Props {
  invoiceId: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function ProofViewer({ invoiceId }: Props) {
  const [proofHash, setProofHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<VerifiedProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  };

  const handlePointerUp = () => setIsDragging(false);

  const handleVerify = async () => {
    if (!proofHash.trim()) return;
    setError(null);
    setVerifying(true);

    try {
      // In a real implementation, this would call splitClient.generatePaymentProof
      // and compare against the proof hash. For now, we'll simulate the verification.
      const proof = await (splitClient as any).generatePaymentProof(proofHash);
      
      if (proof && proof.proofHash === proofHash) {
        setVerified({
          payer: proof.payer,
          amount: proof.amount,
          ledger: proof.ledger,
        });
      } else {
        setError("Proof verification failed. Invalid or expired proof hash.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Verify Payment Proof</h3>

      {!verified ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="proof-hash" className="block text-sm font-medium text-gray-300 mb-2">
              Proof Hash
            </label>
            <input
              id="proof-hash"
              type="text"
              value={proofHash}
              onChange={(e) => setProofHash(e.target.value)}
              placeholder="Paste proof hash here..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !proofHash.trim()}
            className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify Proof"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <span className="text-green-400 text-lg">✓</span>
            <span className="text-sm font-medium text-green-300">Proof Verified</span>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Payer</p>
              <p className="text-sm font-mono text-gray-300">
                {truncateAddress(verified.payer)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm font-medium text-gray-300">
                {formatAmount(verified.amount)} USDC
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ledger</p>
              <p className="text-sm text-gray-300">{verified.ledger}</p>
            </div>
          </div>

          {verified.imageUrl && (
            <div className="space-y-2">
              <div
                className="relative h-64 overflow-hidden rounded-lg border border-gray-700 bg-gray-900"
                style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <img
                  src={verified.imageUrl}
                  alt="Payment proof"
                  draggable={false}
                  className="h-full w-full object-contain select-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Zoom out"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Zoom in"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setVerified(null);
              setProofHash("");
              resetZoom();
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700"
          >
            Verify Another
          </button>
        </div>
      )}
    </div>
  );
}
