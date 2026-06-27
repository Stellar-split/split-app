"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount, truncateAddress } from "@stellar-split/sdk";
import { useInvoiceCustomization } from "@/lib/customization";
import type { Locale } from "@/lib/i18n";
import PaymentSuggestions from "@/components/PaymentSuggestions";
import FundingProgress from "@/components/FundingProgress";
import StatusBadge from "@/components/StatusBadge";
import { InvoiceDetailSkeleton } from "@/components/Skeleton";
import PayModal from "@/components/PayModal";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import CountdownTimer from "@/components/CountdownTimer";
import RecipientPieChart from "@/components/RecipientPieChart";
import InvoiceQR from "@/components/InvoiceQR";
import CopyLinkButton from "@/components/CopyLinkButton";
import TxConfirmModal from "@/components/TxConfirmModal";
import CancelModal from "@/components/CancelModal";
import DuplicateModal from "@/components/DuplicateModal";
import TransferOwnershipModal from "@/components/TransferOwnershipModal";
import CopyLinkButton from "@/components/CopyLinkButton";
import VotingPanel from "@/components/VotingPanel";
import DeadlineExtensionPanel from "@/components/DeadlineExtensionPanel";
import FlowDiagram from "@/components/FlowDiagram";
import SuccessAnimation from "@/components/SuccessAnimation";

const POLL_MS = 10_000;

interface Props {
  params: { id: string };
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  Pending: { label: "Pending", color: "bg-yellow-500", icon: "\u23F3" },
  Released: { label: "Released", color: "bg-green-500", icon: "\u2705" },
  Refunded: { label: "Refunded", color: "bg-gray-500", icon: "\u21A9\uFE0F" },
};

export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"freighter" | "walletconnect">("freighter");
  const [payerNonce, setPayerNonce] = useState<bigint | null>(null);

  const load = async () => {
    const inv = await splitClient.getInvoice(id);
    setInvoice(inv);
    setLoading(false);
  };

  useEffect(() => {
    load().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
    getFreighterPublicKey()
      .then((key) => setPublicKey(key))
      .catch(() => null);
  }, [id]);

  useEffect(() => {
    if (!publicKey) return;
    import("@/lib/paymentNonce").then(({ getPayerNonce }) =>
      getPayerNonce(publicKey).then((n) => setPayerNonce(n)).catch(() => null)
    ).catch(() => null);
  }, [publicKey]);

  useEffect(() => {
    if (!invoice || invoice.status === "Released" || invoice.status === "Refunded") return;
    const pollId = setInterval(() => {
      load().catch((e) => setError(String(e)));
    }, POLL_MS);
    return () => clearInterval(pollId);
  }, [id, invoice?.status]);

  const total = invoice
    ? invoice.recipients.reduce((s, r) => s + r.amount, 0n)
    : 0n;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    const amount = parseAmount(payAmount);
    setPaymentError(null);
    setPaying(true);
    try {
      const result = await payWithNonce({
        payer: publicKey,
        invoiceId: id,
        amount,
      });
      setTxHash(result.txHash);
      setShowSuccess(true);
      await load();
    } catch (err) {
      setPaymentError(String(err));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-700 rounded" />
          <div className="h-4 w-3/4 bg-gray-700 rounded" />
          <div className="h-32 w-full bg-gray-700 rounded" />
          <div className="h-8 w-32 bg-gray-700 rounded" />
        </div>
      </main>
    );
  }

  if (error && !invoice) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 overflow-x-hidden">
        <InvoiceDetailSkeleton />
      </main>
    );
  }

  if (!invoice) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Invoice #{id}
          </h1>
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white ${status.color}`}
          >
            <span>{status.icon}</span>
            <span>{status.label}</span>
          </span>
        </div>

      <div className="mb-6">
        <FlowDiagram invoice={invoice} />
      </div>

      <CloneLineageTree invoiceId={id} />
        <StatusBadge status={invoice.status as any} size="md" />
        <div className="ml-auto flex items-center gap-2 print:hidden flex-wrap justify-end">
          <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`} />
          {isCreator && invoice.status === "Pending" && (
            <>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-sm transition-colors"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-sm transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Creator</p>
          <p className="text-sm font-mono text-gray-200 truncate" title={invoice.creator}>
            {truncateAddress(invoice.creator, 6)}
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recipients</p>
          <p className="text-2xl font-bold text-white">{invoice.recipients.length}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payments</p>
          <p className="text-2xl font-bold text-white">{invoice.payments.length}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deadline</p>
          <div className="text-sm font-medium text-gray-200">
            {invoice.deadline > 0 ? (
              <CountdownTimer deadline={invoice.deadline} />
            ) : (
              "No deadline"
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <section aria-labelledby="progress-heading" className="mb-8">
        <h2 id="progress-heading" className="sr-only">Payment Progress</h2>
        <FundingProgress funded={invoice.funded} total={total} token={invoice.token || "USDC"} />
        {channelState?.opened && (
          <p className="text-sm text-indigo-300 mt-1">
            · Channel balance: {formatAmount(channelState.balance)} USDC
          </p>
        )}
        {invoice.deadline > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-400">Time remaining:</span>
            <CountdownTimer deadline={invoice.deadline} />
          </div>
        )}
      </section>

      {/* QR */}
      <div className="mb-8">
        <InvoiceQR invoiceId={id} />
      </div>

      {/* Payments */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">
          Payments ({invoice.payments.length})
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-gray-500 text-sm bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-6 text-center">
            No payments yet. Be the first to pay!
          </p>
        ) : (
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Payer</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {invoice.payments.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-gray-300 truncate max-w-[200px]" title={p.payer}>
                      {truncateAddress(p.payer)}
                    </td>
                    <td className="px-4 py-2 text-right text-indigo-300 font-medium">
                      {formatAmount(p.amount)} USDC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recipients */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Recipients</h2>
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
          <RecipientPieChart recipients={invoice.recipients} total={total} />
          <ul className="flex flex-col gap-2 mt-4">
            {invoice.recipients.map((r, i) => (
              <li
                key={i}
                className="flex justify-between items-center gap-2 bg-gray-900/60 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span className="font-mono text-gray-300 truncate text-sm" title={r.address}>
                    {truncateAddress(r.address, 8)}
                  </span>
                </div>
                <span className="text-indigo-300 font-medium text-sm shrink-0">
                  {formatAmount(r.amount)} USDC
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pay Section */}
      {invoice.status === "Pending" && publicKey && (
        <section className="mb-8 bg-gray-800/60 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pay Toward Invoice</h2>
          <PaymentMethodSelector
            onMethodChange={setPaymentMethod}
            payerAddress={publicKey}
            recipientAddress={invoice.recipients[0]?.address}
          />
          <form onSubmit={handlePay} className="flex flex-col gap-4 mt-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-300 mb-1">
                Amount (USDC)
              </label>
              <input
                id="pay-amount"
                type="number"
                step="0.0000001"
                min="0.0000001"
                max={formatAmount(remaining)}
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {paymentError && (
              <p role="alert" className="text-red-400 text-sm">{paymentError}</p>
            )}
            <button
              type="submit"
              disabled={paying}
              className="min-h-12 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50"
            >
              {paying ? "Sending Payment…" : `Pay ${payAmount || "0"} USDC`}
            </button>
          </form>
        </section>
      )}

      {showPayModal && invoice && publicKey && (
        <PayModal
          invoice={invoice}
          total={total}
          publicKey={publicKey}
          onPay={async (amount, email) => {
            return payWithChannel(amount, email);
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {invoice.status !== "Pending" && (
        <div className="mb-8 bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-4 text-center">
          <p className="text-gray-400 text-sm">
            This invoice is <span className="font-semibold text-white">{invoice.status.toLowerCase()}</span> and no longer accepts payments.
          </p>
        </div>
      )}

      {/* Token & Contract Info */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Details</h2>
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl divide-y divide-gray-700">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Invoice ID</span>
            <span className="text-sm font-mono text-gray-200">#{id}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Token</span>
            <span className="text-sm font-mono text-gray-200 truncate ml-4" title={invoice.token}>
              {truncateAddress(invoice.token, 8)}
            </span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Deadline</span>
            <span className="text-sm text-gray-200">
              {invoice.deadline > 0
                ? new Date(invoice.deadline * 1000).toLocaleString()
                : "No deadline"}
            </span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Total Amount</span>
            <span className="text-sm font-semibold text-indigo-300">{formatAmount(total)} USDC</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Funded</span>
            <span className="text-sm font-medium text-green-400">{formatAmount(invoice.funded)} USDC</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-400">Status</span>
            <span className={`text-sm font-medium ${status.color.replace("bg-", "text-")}`}>
              {invoice.status}
            </span>
          </div>
          {payerNonce !== null && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-400">Your Nonce</span>
              <span className="text-sm font-mono text-gray-200">{payerNonce.toString()}</span>
            </div>
          )}
        </div>
      </section>

      {showCancelModal && (
        <CancelModal
          invoiceId={id}
          payments={invoice.payments}
          onConfirm={async () => {
            await (splitClient as any).cancelInvoice(id);
            await load();
            setShowCancelModal(false);
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showDuplicateModal && (
        <DuplicateModal
          invoiceId={id}
          onConfirm={(deadlineIso) => {
            setShowDuplicateModal(false);
            router.push(`/invoice/new?from=${id}&deadline=${deadlineIso}`);
          }}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

      {txHash && showSuccess && (
        <SuccessAnimation
          invoiceId={id}
          txHash={txHash}
          onDismiss={() => setShowSuccess(false)}
        />
      )}

      {txHash && !showSuccess && (
        <TxConfirmModal
          txHash={txHash}
          action="Payment sent"
          onClose={() => setTxHash(null)}
        />
      )}
    </main>
  );
}
