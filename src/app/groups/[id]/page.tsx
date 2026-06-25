"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";
import type { Invoice } from "@stellar-split/sdk";

interface GroupStatus {
  id: string;
  memberInvoices: Invoice[];
  totalFunded: bigint;
  totalRequired: bigint;
  allFunded: boolean;
}

interface InvoiceRow {
  id: string;
  status: string;
  funded: bigint;
  total: bigint;
}

const POLL_MS = 10_000;

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupStatus | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => {
        setError("Connect your Freighter wallet to view group details.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchGroup = async () => {
      try {
        const status = await (splitClient as any).getGroupStatus(groupId);
        if (!status) {
          setGroup(null);
          setInvoices([]);
          return;
        }

        const memberInvoices: Invoice[] = status.memberInvoices || [];
        const totalFunded = memberInvoices.reduce(
          (sum: bigint, inv: Invoice) => sum + inv.funded,
          0n,
        );
        const totalRequired = memberInvoices.reduce(
          (sum: bigint, inv: Invoice) =>
            sum +
            inv.recipients.reduce(
              (s: bigint, r: { amount: bigint }) => s + r.amount,
              0n,
            ),
          0n,
        );

        setGroup({
          id: groupId,
          memberInvoices,
          totalFunded,
          totalRequired,
          allFunded: totalFunded >= totalRequired,
        });

        setInvoices(
          memberInvoices.map((inv: Invoice) => ({
            id: inv.id,
            status: inv.status,
            funded: inv.funded,
            total: inv.recipients.reduce(
              (s: bigint, r: { amount: bigint }) => s + r.amount,
              0n,
            ),
          })),
        );
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
    const interval = setInterval(fetchGroup, POLL_MS);
    return () => clearInterval(interval);
  }, [publicKey, groupId]);

  const aggregatePct =
    group && group.totalRequired > 0n
      ? Number((group.totalFunded * 100n) / group.totalRequired)
      : 0;

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <SkeletonCard />
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <Link
          href="/groups"
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          &larr; Back to groups
        </Link>
      </main>
    );
  }

  if (!group || invoices.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Link
          href="/groups"
          className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block"
        >
          &larr; Back to groups
        </Link>
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-gray-400 mb-4">This group has no invoices yet</p>
          <Link
            href="/invoice/new"
            className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
          >
            Create Invoice
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <Link
        href="/groups"
        className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block"
      >
        &larr; Back to groups
      </Link>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2">Group {group.id}</h1>
        <p className="text-sm text-gray-400 mb-4">
          {invoices.length} member invoice{invoices.length !== 1 ? "s" : ""}
        </p>

        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Aggregate Progress</span>
          <span>
            {formatAmount(group.totalFunded)} /{" "}
            {formatAmount(group.totalRequired)} USDC
          </span>
        </div>
        <PaymentProgress
          funded={group.totalFunded}
          total={group.totalRequired}
        />
        <p className="text-right text-sm text-gray-400 mt-1">
          {Math.min(100, aggregatePct).toFixed(1)}% funded
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Invoice Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left px-6 py-3 font-medium">Invoice</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-right px-6 py-3 font-medium">Funded</th>
                <th className="text-right px-6 py-3 font-medium">Total</th>
                <th className="text-right px-6 py-3 font-medium">% Funded</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const pct =
                  inv.total > 0n ? Number((inv.funded * 100n) / inv.total) : 0;
                const statusColor: Record<string, string> = {
                  Pending: "text-yellow-400",
                  Released: "text-green-400",
                  Refunded: "text-gray-400",
                };

                return (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/invoice/${inv.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Invoice #{inv.id}
                      </Link>
                    </td>
                    <td
                      className={`px-6 py-3 ${statusColor[inv.status] ?? "text-gray-400"}`}
                    >
                      {inv.status}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      {formatAmount(inv.funded)}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      {formatAmount(inv.total)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {Math.min(100, pct).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
