"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import TxConfirmModal from "@/components/TxConfirmModal";
import { SkeletonCard } from "@/components/Skeleton";
import type { Invoice } from "@stellar-split/sdk";

interface GroupStatus {
  id: string;
  memberInvoices: Invoice[];
  totalFunded: bigint;
  totalRequired: bigint;
  allFunded: boolean;
}

const POLL_MS = 10_000;

export default function GroupsPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ txHash: string; groupId: string } | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view groups."),
      );
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchGroups = async () => {
      setLoading(true);
      try {
        const groupIds = JSON.parse(
          localStorage.getItem("groupIds") || "[]"
        ) as string[];

        const groupsData: GroupStatus[] = [];
        for (const groupId of groupIds) {
          const status = await splitClient.getGroupStatus(groupId);
          if (status) {
            const memberInvoices = status.memberInvoices || [];
            const totalFunded = memberInvoices.reduce(
              (sum, inv) => sum + inv.funded,
              0n
            );
            const totalRequired = memberInvoices.reduce(
              (sum, inv) =>
                sum +
                inv.recipients.reduce((s, r) => s + r.amount, 0n),
              0n
            );

            groupsData.push({
              id: groupId,
              memberInvoices,
              totalFunded,
              totalRequired,
              allFunded: totalFunded >= totalRequired,
            });
          }
        }
        setGroups(groupsData);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    const interval = setInterval(fetchGroups, POLL_MS);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleReleaseGroup = async (groupId: string) => {
    setReleasing(groupId);
    try {
      const txHash = await splitClient.releaseGroup(groupId);
      setTxModal({ txHash, groupId });
    } catch (err) {
      setError(String(err));
    } finally {
      setReleasing(null);
    }
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Invoice Groups</h1>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      {txModal && (
        <TxConfirmModal
          txHash={txModal.txHash}
          action="Group released"
          onClose={() => {
            setTxModal(null);
            window.location.reload();
          }}
        />
      )}

      <h1 className="text-3xl font-bold mb-8">Invoice Groups</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No invoice groups yet</p>
          <Link
            href="/invoice/new"
            className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
          >
            Create Invoice
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Group {group.id}</h2>
                  <p className="text-sm text-gray-400">
                    {group.memberInvoices.length} member invoice
                    {group.memberInvoices.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {group.allFunded && (
                  <button
                    type="button"
                    onClick={() => handleReleaseGroup(group.id)}
                    disabled={releasing === group.id}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
                  >
                    {releasing === group.id ? "Releasing…" : "Release Group"}
                  </button>
                )}
              </div>

              {/* Combined progress */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Overall Progress</span>
                  <span>
                    {formatAmount(group.totalFunded)} /{" "}
                    {formatAmount(group.totalRequired)} USDC
                  </span>
                </div>
                <PaymentProgress
                  funded={group.totalFunded}
                  total={group.totalRequired}
                />
              </div>

              {/* Member invoices */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase">
                  Member Invoices
                </p>
                {group.memberInvoices.map((invoice) => {
                  const total = invoice.recipients.reduce(
                    (sum, r) => sum + r.amount,
                    0n
                  );
                  const pct =
                    total > 0n
                      ? Number((invoice.funded * 100n) / total)
                      : 0;

                  return (
                    <Link
                      key={invoice.id}
                      href={`/invoice/${invoice.id}`}
                      className="block p-3 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Invoice #{invoice.id}
                        </span>
                        <span className="text-xs text-gray-400">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <PaymentProgress funded={invoice.funded} total={total} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
