'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useWalletContext } from '@/contexts/WalletContext';

export default function SignInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useWalletContext();
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [xdr, setXdr] = useState<string | null>(null);

  const handleSign = async () => {
    if (!address) return;
    setStatus('building');
    setError(null);

    try {
      // Dynamically import the transaction builder — keeps stellar-sdk
      // out of the initial JS bundle for routes that don't need it.
      const { buildPaymentTransaction } = await import(
        '@/lib/stellar/transactionBuilder'
      );

      const result = await buildPaymentTransaction({
        sourcePublicKey: address,
        destinationPublicKey: address, // placeholder — real app resolves from invoice
        assetCode: 'XLM',
        assetIssuer: null,
        amount: '0',
        memo: `Invoice ${id}`,
      });

      setXdr(result.xdr);
      setStatus('signing');

      const { signTransaction } = await import('@stellar/freighter-api');
      await signTransaction(result.xdr, {
        networkPassphrase: result.networkPassphrase,
      });

      setStatus('done');
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-bold text-white mb-6">Sign Invoice #{id}</h1>

      {!address && (
        <p className="text-amber-400 text-sm">Connect your wallet to sign this invoice.</p>
      )}

      {address && status === 'idle' && (
        <button
          onClick={handleSign}
          className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Sign Transaction
        </button>
      )}

      {status === 'building' && (
        <p role="status" aria-label="Building transaction" className="text-slate-400 text-sm">
          Building transaction…
        </p>
      )}

      {status === 'signing' && (
        <p role="status" aria-label="Waiting for signature" className="text-slate-400 text-sm">
          Waiting for wallet signature…
        </p>
      )}

      {status === 'done' && (
        <p className="text-emerald-400 text-sm font-medium">Transaction signed successfully.</p>
      )}

      {status === 'error' && (
        <p className="text-red-400 text-sm">Error: {error}</p>
      )}
    </main>
  );
}
