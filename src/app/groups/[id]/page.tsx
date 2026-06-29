"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import { SkeletonCard, SkeletonRow } from "@/components/Skeleton";
import PayModal from "@/components/PayModal";
import type { Invoice } from "@stellar-split/sdk";

interface MemberRow {
  address: string;
  invoice: Invoice;
  total: bigint;
  contributed: bigint;
  pct: number;
  paid: boolean;
}

const POLL_MS = 10_000;

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletError, setWalletError] = useState(false);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [groupName, setGroupName] = useState<string>("");
  const [creator, setCreator] = useState<string | null>(null);
  const [totalRequired, setTotalRequired] = useState(0n);
  const [totalFunded, setTotalFunded] = useState(0n);
  const [allFunded, setAllFunded] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<{ invoice: Invoice; total: bigint } | null>(null);

  // Try to get wallet; page is read-only without it
  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setWalletError(true));
  }, []);

  const fetchGroup = useCallback(async () => {
    try {
      const status = await (splitClient as any).getGroupStatus(groupId);
      if (!status) {
        setMemberRows([]);
        setLoading(false);
        return;
      }

      const memberInvoices: Invoice[] = status.memberInvoices ?? [];
      const name: string = status.name ?? `Group ${groupId}`;
      const creatorAddr: string = status.creator ?? memberInvoices[0]?.creator ?? "";

      let req = 0n;
      let funded = 0n;
      let earliest: number | null = null;

      const rows: MemberRow[] = memberInvoices.map((inv) => {
        const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
        req += total;
        funded += inv.funded;
        if (!earliest || inv.deadline < earliest) earliest = inv.deadline;

        return {
          address: inv.creator,
          invoice: inv,
          total,
          contributed: inv.funded,
          pct: total > 0n ? Math.min(100, Number((inv.funded * 100n) / total)) : 0,
          paid: total > 0n && inv.funded >= total,
        };
      });

      setGroupName(name);
      setCreator(creatorAddr);
      setTotalRequired(req);
      setTotalFunded(funded);
      setAllFunded(req > 0n && funded >= req);
      setDeadline(earliest);
      setMemberRows(rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    const id = setInterval(fetchGroup, POLL_MS);
    return () => clearInterval(id);
  }, [fetchGroup]);

  // Countdown helpers
  function countdown(ts: number): string {
    const diff = ts - Math.floor(Date.now() / 1000);
    if (diff <= 0) return "Expired";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const fundedPct =
    totalRequired > 0n
      ? Math.min(100, Number((totalFunded * 100n) / totalRequired))
      : 0;

  const isCreator = publicKey && creator && publicKey === creator;

  const handleReleaseFunds = async () => {
    if (!publicKey) return;
    try {
      await (splitClient as any).releaseGroupFunds({ groupId, caller: publicKey });
      await fetchGroup();
    } catch (e) {
      alert(String(e));
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <SkeletonCard />
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      </main>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <Link href="/groups" className="text-indigo-400 hover:text-indigo-300 text-sm">&larr; Back to groups</Link>
      </main>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (memberRows.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/groups" className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block">&larr; Back to groups</Link>
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-gray-400 mb-4">This group has no invoices yet.</p>
          <Link href="/invoice/new" className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">
            Create Invoice
          </Link>
        </div>
      </main>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <Link href="/groups" className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block">&larr; Back to groups</Link>

      {/* Read-only notice */}
      {walletError && (
        <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
          Connect your Freighter wallet to contribute or release funds.
        </div>
      )}

      {/* Group header card */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{groupName}</h1>
            <p className="text-sm text-gray-400">
              {memberRows.length} member{memberRows.length !== 1 ? "s" : ""}
              {deadline && (
                <span className="ml-3">
                  · Deadline:{" "}
                  <span className={deadline <= Math.floor(Date.now() / 1000) ? "text-red-400" : "text-yellow-400"}>
                    {countdown(deadline)}
                  </span>
                </span>
              )}
            </p>
          </div>
          {/* Creator-only: Release Funds */}
          {isCreator && allFunded && (
            <button
              onClick={handleReleaseFunds}
              className="min-h-10 px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold transition-colors"
            >
              Release Funds
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Pool Progress</span>
          <span>{formatAmount(totalFunded)} / {formatAmount(totalRequired)} USDC</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${fundedPct}%` }}
            role="progressbar"
            aria-valuenow={fundedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${fundedPct.toFixed(1)}% funded`}
          />
        </div>
        <p className="text-right text-xs text-gray-400 mt-1">{fundedPct.toFixed(1)}% funded</p>
      </div>

      {/* Member table — collapses to cards on mobile */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Members</h2>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left px-6 py-3 font-medium">Member</th>
                <th className="text-right px-6 py-3 font-medium">Contributed</th>
                <th className="text-right px-6 py-3 font-medium">Share</th>
                <th className="text-right px-6 py-3 font-medium">% of Pool</th>
                <th className="text-right px-6 py-3 font-medium">Status</th>
                <th className="text-right px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row) => (
                <tr key={row.address} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-3 font-mono text-sm text-gray-300">
                    {truncateAddress(row.address)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono">{formatAmount(row.contributed)} USDC</td>
                  <td className="px-6 py-3 text-right font-mono">{formatAmount(row.total)} USDC</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{row.pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${row.paid ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {row.paid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {!row.paid && publicKey && (
                      <button
                        onClick={() => setPayTarget({ invoice: row.invoice, total: row.total })}
                        className="min-h-8 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold transition-colors"
                      >
                        Contribute
                      </button>
                    )}
                    {!row.paid && !publicKey && (
                      <span className="text-xs text-gray-500">Connect wallet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-700">
          {memberRows.map((row) => (
            <div key={row.address} className="px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-gray-300">{truncateAddress(row.address)}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${row.paid ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {row.paid ? "Paid" : "Unpaid"}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Contributed</span>
                <span className="font-mono">{formatAmount(row.contributed)} / {formatAmount(row.total)} USDC</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${row.pct}%` }} />
              </div>
              {!row.paid && publicKey && (
                <button
                  onClick={() => setPayTarget({ invoice: row.invoice, total: row.total })}
                  className="w-full min-h-10 mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
                >
                  Contribute
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pay Modal */}
      {payTarget && publicKey && (
        <PayModal
          invoice={payTarget.invoice}
          total={payTarget.total}
          publicKey={publicKey}
          onClose={() => setPayTarget(null)}
          onPay={async (amount) => {
            const result = await payWithNonce({
              payer: publicKey,
              invoiceId: payTarget.invoice.id,
              amount,
            });
            await fetchGroup();
            setPayTarget(null);
            return result;
          }}
        />
      )}
    </main>
  );
}
