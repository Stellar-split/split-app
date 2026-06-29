"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount, truncateAddress, type Invoice } from "@stellar-split/sdk";
import { useInvoiceCustomization } from "@/lib/customization";
import type { Locale } from "@/lib/i18n";
import PaymentSuggestions from "@/components/PaymentSuggestions";
import FundingProgress from "@/components/FundingProgress";
import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeline";
import { InvoiceDetailSkeleton } from "@/components/Skeleton";
import PayModal from "@/components/PayModal";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import CopyLinkButton from "@/components/CopyLinkButton";
import CopyButton from "@/components/CopyButton";
import TxConfirmModal from "@/components/TxConfirmModal";
import CancelModal from "@/components/CancelModal";
import DuplicateModal from "@/components/DuplicateModal";
import TransferOwnershipModal from "@/components/TransferOwnershipModal";
import ShareModal from "@/components/ShareModal";
import VotingPanel from "@/components/VotingPanel";
import DeadlineExtensionPanel from "@/components/DeadlineExtensionPanel";
import SuccessAnimation from "@/components/SuccessAnimation";
import RecipientPayoutTracker from "@/components/RecipientPayoutTracker";
import CloneLineageTree from "@/components/CloneLineageTree";
import CountdownTimer from "@/components/CountdownTimer";
import SplitCalculator from "@/components/SplitCalculator";
import ActivityFeed from "@/components/ActivityFeed";
import InstallmentTracker from "@/components/InstallmentTracker";
import InstallmentPanel from "@/components/InstallmentPanel";
import CoCreatorPanel from "@/components/CoCreatorPanel";
import PaymentChannelPanel from "@/components/PaymentChannelPanel";
import DisputeTimeline from "@/components/DisputeTimeline";
import AuditLogTable from "@/components/AuditLogTable";
import VersionHistory from "@/components/VersionHistory";
import CommentSection from "@/components/CommentSection";
import InvoiceTimeline from "@/components/InvoiceTimeline";
import InvoiceExportButton from "@/components/InvoiceExportButton";

const RecipientPieChart = dynamic(() => import("@/components/RecipientPieChart"), { ssr: false });
const InvoiceQR = dynamic(() => import("@/components/InvoiceQR"), { ssr: false });
const FlowDiagram = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });

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
  const [showAchievement, setShowAchievement] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"freighter" | "walletconnect">("freighter");
  const [amountLocked, setAmountLocked] = useState(false);
  const prevPayAmountRef = useRef("");
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"audit" | "history" | "notes">("audit");

  const prevStatusRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exportingTimeline, setExportingTimeline] = useState(false);

  useEffect(() => {
    // TODO: implement notification subscription
    // setNotifySubscribed(isSubscribedToInvoice(id));
  }, [id]);

  const handleNotifyMe = async () => {
    // TODO: implement notification permissions
    // const permission = await requestNotificationPermission();
    // if (permission !== "granted") {
    //   setNotifyDenied(true);
    //   return;
    // }
    // subscribeToInvoice(id);
    // setNotifySubscribed(true);
    // setNotifyDenied(false);
  };

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
    // TODO: implement payer nonce
    // import("@/lib/paymentNonce").then(({ getPayerNonce }) =>
    //   getPayerNonce(publicKey).then((n) => setPayerNonce(n)).catch(() => null)
    // ).catch(() => null);
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
      const result = await splitClient.pay({
        payer: publicKey,
        invoiceId: id,
        amount,
      });
      setTxHash(result.txHash);
      setShowSuccess(true);
      try {
        const existing = JSON.parse(localStorage.getItem("stellarsplit_adapter_usage") ?? "[]");
        existing.push({ adapter: paymentMethod, timestamp: Date.now() });
        localStorage.setItem("stellarsplit_adapter_usage", JSON.stringify(existing));
      } catch { /* ignore storage errors */ }
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      await load();
    } catch (err) {
      setError(String(err));
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
          <StatusBadge status={invoice.status as any} size="sm" />
          <CopyButton text={id} className="!py-1 !px-2 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`} />
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
            aria-label="Share invoice"
          >
            Share
          </button>
          <InvoiceExportButton invoice={invoice} total={total} />
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
              <DeadlineCountdown deadline={invoice.deadline} />
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
        {invoice.deadline > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-400">Time remaining:</span>
            <DeadlineCountdown deadline={invoice.deadline} />
          </div>
        )}
      </section>

      {/* QR */}
      <div className="mb-8">
        <InvoiceQR invoiceId={id} />
      </div>

      {/* Status Timeline */}
      <section className="mb-8" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-lg font-semibold text-white mb-4">Status Timeline</h2>
        <StatusTimeline invoice={invoice} total={total} />
      </section>

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
      <RecipientPayoutTracker invoice={invoice} publicKey={publicKey} />

      {/* Split Calculator */}
      {invoice.status === "Pending" && <SplitCalculator invoice={invoice} />}

      {/* Activity Feed */}
      {/* <ActivityFeed invoice={invoice} /> */}

      {/* Installment schedule — only shown to payers with a registered plan */}
      {publicKey && (
        <>
          <InstallmentTracker
            invoice={invoice}
            publicKey={publicKey}
            onPayNow={(amount) => {
              setPayAmount(formatAmount(amount));
              setShowPayModal(true);
            }}
          />
          <InstallmentPanel invoiceId={id} publicKey={publicKey} />
        </>
      )}

      {/* Deadline extension voting — shown to payers on Pending invoices */}
      {publicKey && (
        <VotingPanel invoice={invoice} publicKey={publicKey} />
      )}

      {/* Deadline extension request/approval flow */}
      {invoice.status === "Pending" && (
        <DeadlineExtensionPanel
          invoiceId={id}
          invoiceCreator={invoice.creator}
          invoiceDeadline={invoice.deadline}
          currentAddress={publicKey}
        />
      )}

      {/* Co-Creator Management — only shown to primary creator */}
      {publicKey && (
        <CoCreatorPanel invoice={invoice} publicKey={publicKey} onUpdate={load} />
      )}

      {/* Payment channel panel for frequent payers - DISABLED due to pre-existing issues */}
      {/* TODO: Re-enable when payment channel is fully implemented */}

      {/* Pay button → opens modal */}
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
                max={formatAmount(total)}
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
            return splitClient.pay({ payer: publicKey, invoiceId: id, amount });
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {invoice.status !== "Pending" && (
        <p className="text-gray-400 text-sm mb-8">
          This invoice is {invoice.status.toLowerCase()} and no longer accepts payments.
        </p>
      )}

      {/* Dispute Timeline — shown when invoice has an active or resolved dispute */}
      {/* as any: disputeStatus is not yet declared in the published @stellar-split/sdk Invoice type */}
      {(invoice as any).disputeStatus && (
        <DisputeTimeline
          invoiceId={id}
          // as any: disputeStatus is not yet declared in the published @stellar-split/sdk Invoice type
          disputeStatus={(invoice as any).disputeStatus}
        />
      )}

      {/* Activity Timeline */}
      <section className="mb-8" aria-labelledby="activity-timeline-heading">
        <h2 id="activity-timeline-heading" className="text-lg font-semibold text-white mb-4">Activity Timeline</h2>
        <InvoiceTimeline invoiceId={id} />
      </section>

      {/* Tabbed detail section: Audit Log / History / Notes */}
      <section className="mb-8">
        <div className="flex gap-1 border-b border-gray-700 mb-4" role="tablist" aria-label="Invoice details">
          {(["audit", "history", "notes"] as const).map((tab) => {
            const labels: Record<string, string> = { audit: "Audit Log", history: "History", notes: "Notes" };
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeDetailsTab === tab}
                onClick={() => setActiveDetailsTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg -mb-px border-b-2 ${
                  activeDetailsTab === tab
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        {activeDetailsTab === "audit" && <AuditLogTable invoiceId={id} invoice={invoice ?? undefined} />}
        {activeDetailsTab === "history" && <VersionHistory invoiceId={id} />}
        {activeDetailsTab === "notes" && publicKey && (
          <CommentSection invoiceId={id} walletAddress={publicKey} />
        )}
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

      <ShareModal
        open={showShareModal}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/invoice/${id}`}
        onClose={() => setShowShareModal(false)}
      />
    </main>
  );
}
