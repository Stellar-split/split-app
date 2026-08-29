"use client";

import { useEffect, useState } from "react";
import { formatAmount, type Invoice } from "@stellar-split/sdk";
import { splitClient } from "@/lib/stellar";
import StatusBadge from "@/components/StatusBadge";
import WalletAddress from "@/components/WalletAddress";
import { InvoiceDetailSkeleton } from "@/components/Skeleton";

interface Props {
  params: { id: string };
}

export default function PublicInvoicePage({ params }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const inv = await splitClient.getInvoice(params.id);
        setInvoice(inv);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [params.id]);

  if (loading) {
    return <InvoiceDetailSkeleton />;
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400">Invoice Not Found</h1>
          <p className="text-gray-400 mt-2">{error || "This invoice does not exist or has been deleted."}</p>
        </div>
      </div>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const pct = total === 0n ? 0 : Number((invoice.funded * 100n) / total);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Invoice #{params.id}</h1>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Amount</div>
            <div className="text-2xl font-mono font-bold">{formatAmount(total)} USDC</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Funded</div>
            <div className="text-2xl font-mono font-bold">{formatAmount(invoice.funded)} USDC</div>
          </div>
        </div>

        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm text-gray-400">{pct}% funded</div>

        {invoice.recipients.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-700">
            <h2 className="text-lg font-bold mb-4">Recipients</h2>
            <div className="space-y-3">
              {invoice.recipients.map((recipient, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                  <WalletAddress address={recipient.address} showCopy />
                  <div className="font-mono">{formatAmount(recipient.amount)} USDC</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
