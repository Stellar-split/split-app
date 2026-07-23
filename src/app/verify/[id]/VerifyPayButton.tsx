"use client";

import { useEffect, useState } from "react";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { parseAmount } from "@stellar-split/sdk";

interface Props {
  invoiceId: string;
  status: string;
}

export default function VerifyPayButton({ invoiceId, status }: Props) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
  }, []);

  if (status !== "Pending" || !publicKey) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPaying(true);
    try {
      const result = await payWithNonce({
        payer: publicKey,
        invoiceId,
        amount: parseAmount(payAmount),
      });
      setTxHash(result.txHash);
      setPayAmount("");
    } catch (err) {
      setError(String(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-4 mt-8">
      <h2 className="text-lg font-semibold">Pay toward this invoice</h2>
      <input
        type="number"
        step="0.0000001"
        min="0.0000001"
        placeholder="Amount in USDC"
        value={payAmount}
        onChange={(e) => setPayAmount(e.target.value)}
        required
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {txHash && (
        <p className="text-green-400 text-sm">
          Payment sent! Tx: {txHash.slice(0, 12)}…
        </p>
      )}
      <button
        type="submit"
        disabled={paying}
        className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {paying ? "Sending…" : "Pay"}
      </button>
    </form>
  );
}
