"use client";

import { useMemo, useState } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice, Recipient } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  publicKey: string | null;
}

type PayoutStatus = "Pending" | "Paid" | "Claimed" | "Refunded";

function formatCurrency(amount: bigint): string {
  return `${formatAmount(amount)} USDC`;
}

export default function RecipientPayoutTracker({ invoice, publicKey }: Props) {
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);

  const { recipients } = invoice;
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  const getStatus = (recipient: Recipient): PayoutStatus => {
    if (invoice.status === "Refunded") return "Refunded";
    if (invoice.status === "Released") {
      const claimedAddresses: string[] = (invoice as unknown as { claimed?: string[] }).claimed ?? [];
      if (claimedAddresses.includes(recipient.address)) return "Claimed";
      return "Paid";
    }
    return "Pending";
  };

  const statusStyles: Record<PayoutStatus, { badge: string; text: string }> = {
    Pending: {
      badge: "bg-yellow-500/20 text-yellow-300",
      text: "text-yellow-300",
    },
    Paid: {
      badge: "bg-green-500/20 text-green-300",
      text: "text-green-300",
    },
    Claimed: {
      badge: "bg-indigo-500/20 text-indigo-300",
      text: "text-indigo-300",
    },
    Refunded: {
      badge: "bg-gray-500/20 text-gray-300",
      text: "text-gray-300",
    },
  };

  const handleClaim = async (invoiceId: string) => {
    if (!publicKey) return;
    setClaimingId(invoiceId);
    setClaimError(null);
    setClaimTx(null);
    try {
      const { splitClient } = await import("@/lib/stellar");
      const result = await (splitClient as unknown as { claimShare: (id: string) => Promise<{ txHash?: string }> }).claimShare(
        invoiceId
      );
      setClaimTx(result?.txHash ?? "ok");
    } catch (err) {
      setClaimError(String(err));
    } finally {
      setClaimingId(null);
    }
  };

  const recipientRows = useMemo(
    () =>
      recipients.map((r) => {
        const status = getStatus(r);
        const styles = statusStyles[status];
        const isWallet = publicKey === r.address;
        const canClaim =
          isWallet && status === "Paid" && invoice.status === "Released";

        return (
          <tr
            key={r.address}
            className={
              isWallet
                ? "bg-indigo-500/10 border-b border-indigo-400/20"
                : "border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors"
            }
          >
            <td className="px-4 py-3 text-sm font-mono text-gray-300 truncate max-w-[200px]" title={r.address}>
              <span className="sm:hidden">{truncateAddress(r.address)}</span>
              <span className="hidden sm:inline">{r.address}</span>
              {isWallet && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-semibold inline-flex items-center gap-1">
                  You
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-sm text-gray-300 text-right">
              {total > 0n
                ? `${((Number(r.amount) * 100) / Number(total)).toFixed(2)}%`
                : "0.00%"}
            </td>
            <td className="px-4 py-3 text-sm text-indigo-300 font-medium text-right tabular-nums">
              {formatCurrency(r.amount)}
            </td>
            <td className="px-4 py-3 text-sm text-right">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold inline-block ${styles.badge}`}>
                {status}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              {canClaim && (
                <button
                  type="button"
                  onClick={() => handleClaim(invoice.id)}
                  disabled={claimingId === invoice.id}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {claimingId === invoice.id ? "Claiming…" : "Claim Payout"}
                </button>
              )}
              {claimError && (
                <p role="alert" className="text-red-400 text-xs mt-1">{claimError}</p>
              )}
              {claimTx && (
                <p role="status" className="text-green-400 text-xs mt-1">
                  Claimed! Tx: {claimTx.slice(0, 12)}…
                </p>
              )}
            </td>
          </tr>
        );
      }),
    [recipients, total, publicKey, invoice.status, invoice.id, claimingId, claimError, claimTx]
  );

  return (
    <section className="mb-8" aria-labelledby="payout-tracker-heading">
      <h2 id="payout-tracker-heading" className="text-lg font-semibold text-white mb-3">
        Recipient Payouts
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-700 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
              <th scope="col" className="text-left px-4 py-3 font-medium">Address</th>
              <th scope="col" className="text-right px-4 py-3 font-medium">Share</th>
              <th scope="col" className="text-right px-4 py-3 font-medium">Expected Amount</th>
              <th scope="col" className="text-right px-4 py-3 font-medium">Status</th>
              <th scope="col" className="text-right px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50 bg-gray-900/40">
            {recipientRows}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800/80 border-t border-gray-700">
              <td colSpan={2} className="px-4 py-3 text-sm text-gray-400">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </td>
              <td className="px-4 py-3 text-sm text-indigo-300 font-semibold text-right tabular-nums">
                {formatCurrency(total)}
              </td>
              <td colSpan={2} className="px-4 py-3 text-sm text-gray-400 text-right">
                Total payout
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
