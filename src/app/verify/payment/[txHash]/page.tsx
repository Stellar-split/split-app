'use client';

import { useEffect, useState } from 'react';
import { splitClient } from '@/lib/stellar';
import { formatAmount, truncateAddress } from '@stellar-split/sdk';
import CopyLinkButton from '@/components/CopyLinkButton';

interface PaymentProof {
  invoiceId: string;
  payer: string;
  amount: bigint;
  ledger: number;
  proofHash: string;
}

interface Props {
  params: { txHash: string };
}

export default function PaymentVerifyPage({ params }: Props) {
  const { txHash } = params;
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProof = async () => {
      try {
        const result = await (splitClient as any).generatePaymentProof(txHash);
        setProof(result);
      } catch (err) {
        setError(`Payment proof not found for transaction ${txHash}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProof();
  }, [txHash]);

  if (loading) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-700 rounded w-1/2" />
        </div>
      </main>
    );
  }

  if (error || !proof) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Payment Verification</h1>
        <p className="text-red-400" role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-semibold">
          ✓ Verified
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-1">Payment Verified</h1>
      <p className="text-lg text-gray-400 mb-8">Transaction {truncateAddress(txHash)}</p>

      <section className="space-y-6">
        <div className="bg-gray-900 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
          <p className="font-mono text-sm text-indigo-300">{proof.invoiceId}</p>
        </div>

        <div className="bg-gray-900 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Payer</p>
          <p className="font-mono text-sm text-gray-300 break-all">{proof.payer}</p>
        </div>

        <div className="bg-gray-900 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Amount</p>
          <p className="text-lg font-semibold text-indigo-300">{formatAmount(proof.amount)} USDC</p>
        </div>

        <div className="bg-gray-900 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Ledger</p>
          <p className="text-sm text-gray-300">{proof.ledger}</p>
        </div>

        <div className="bg-gray-900 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Proof Hash</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs text-gray-400 break-all bg-gray-800 px-2 py-1 rounded">
              {proof.proofHash}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(proof.proofHash)}
              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
