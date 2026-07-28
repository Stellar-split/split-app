"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  params: { invoiceId: string; amount: string };
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

export default function DeepLinkPayPage({ params }: Props) {
  const { invoiceId, amount: rawAmount } = params;
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Decode amount from URL (may be dot-separated e.g. "10.5" or encoded)
  const decodedAmount = decodeURIComponent(rawAmount);
  const amountDisplay = decodedAmount;

  useEffect(() => {
    splitClient
      .getInvoice(invoiceId)
      .then(setInvoice)
      .catch((e) => setLoadError(String(e)));

    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => null);
  }, [invoiceId]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const key = await getFreighterPublicKey();
      setPublicKey(key);
    } catch (err) {
      setLoadError(`Could not connect wallet: ${err}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleConfirm = () => setConfirmed(true);

  const handlePay = async () => {
    if (!publicKey || !invoice) return;
    setPayError(null);
    setPaying(true);
    try {
      const result = await payWithNonce({
        payer: publicKey,
        invoiceId,
        amount: parseAmount(decodedAmount),
      });
      setTxHash(result.txHash);
    } catch (err) {
      setPayError(String(err));
    } finally {
      setPaying(false);
    }
  };

  // Invalid invoice
  if (loadError) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Invoice Not Found</h1>
        <p className="text-gray-400 text-sm mb-6">{loadError}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        >
          Go Home
        </button>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-gray-400" aria-live="polite">Loading invoice…</p>
      </main>
    );
  }

  // Success state
  if (txHash) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-green-400 mb-2">Payment Sent!</h1>
        <p className="text-sm text-gray-400 mb-1">Invoice #{invoiceId}</p>
        <p className="text-xs font-mono text-gray-500 break-all mb-5">
          Tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
        </p>
        <a
          href={`${STELLAR_EXPERT_BASE}/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold transition-colors"
        >
          View Transaction
        </a>
      </main>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  return (
    <main className="max-w-md mx-auto w-full px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-bold mb-1">Pay Invoice</h1>
      <p className="text-gray-400 text-sm mb-6">
        You were sent a payment link for invoice #{invoiceId}.
      </p>

      {/* Invoice Summary */}
      <div className="bg-gray-900 rounded-xl px-5 py-4 mb-6 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Invoice ID</span>
          <span className="font-mono">{invoiceId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total</span>
          <span className="text-indigo-300">{formatAmount(total)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Your payment</span>
          <span className="font-semibold text-white">{amountDisplay} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Status</span>
          <span className={invoice.status === "Pending" ? "text-yellow-400" : "text-gray-400"}>
            {invoice.status}
          </span>
        </div>
      </div>

      {invoice.status !== "Pending" && (
        <div role="alert" className="mb-6 p-3 rounded-lg bg-gray-800 text-sm text-gray-400">
          This invoice is {invoice.status.toLowerCase()} and is no longer accepting payments.
        </div>
      )}

      {invoice.status === "Pending" && (
        <>
          {/* Wallet connect step */}
          {!publicKey && (
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3">Connect your wallet to continue.</p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            </div>
          )}

          {/* Connected — confirmation step */}
          {publicKey && !confirmed && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-400">
                Connected as <span className="font-mono text-white">{publicKey.slice(0, 8)}…{publicKey.slice(-4)}</span>
              </p>
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
              >
                Confirm Payment of {amountDisplay} USDC
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full min-h-11 px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Confirmed — pay step */}
          {publicKey && confirmed && (
            <div className="flex flex-col gap-4">
              {payError && (
                <p role="alert" className="text-red-400 text-sm">{payError}</p>
              )}
              <button
                type="button"
                onClick={handlePay}
                disabled={paying}
                className="w-full min-h-11 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 font-semibold transition-colors disabled:opacity-50"
              >
                {paying ? "Sending Payment…" : `Pay ${amountDisplay} USDC`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmed(false)}
                disabled={paying}
                className="w-full min-h-11 px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors disabled:opacity-50"
              >
                Back
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
