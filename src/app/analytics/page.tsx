"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import type { Invoice } from "@stellar-split/sdk";

export default function AnalyticsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const publicKey = await getFreighterPublicKey().catch(() => null);
        if (!publicKey) {
          setError("Connect your wallet to view analytics.");
          return;
        }
        const [created, received] = await Promise.all([
          (splitClient as any).getInvoicesByCreator
            ? (splitClient as any).getInvoicesByCreator(publicKey)
            : [],
          (splitClient as any).getInvoicesByRecipient
            ? (splitClient as any).getInvoicesByRecipient(publicKey)
            : [],
        ]);
        // Deduplicate by id
        const all = [...(created ?? []), ...(received ?? [])] as Invoice[];
        const seen = new Set<string>();
        const unique = all.filter((inv) => {
          if (seen.has(inv.id)) return false;
          seen.add(inv.id);
          return true;
        });
        setInvoices(unique);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Analytics</h1>
      <p className="text-gray-400 mb-8">Payment activity over the last 52 weeks.</p>

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/4" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-400 text-sm">{error}</p>
      )}

      {!loading && !error && (
        <section aria-labelledby="heatmap-heading" className="bg-gray-900 rounded-xl p-5">
          <h2 id="heatmap-heading" className="text-lg font-semibold mb-4">
            Payment Activity Heatmap
          </h2>
          <ActivityHeatmap invoices={invoices} />
          {invoices.length === 0 && (
            <p className="text-gray-500 text-sm mt-4">No invoices found. Create or receive invoices to see activity.</p>
          )}
        </section>
      )}
    </main>
  );
}
