"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount, truncateAddress, type Invoice } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import CrossChainPayment from "@/components/CrossChainPayment";
import { useInvoiceCustomization } from "@/lib/customization";
import type { Locale } from "@/lib/i18n";
import { useInvoiceStream } from "@/hooks/useInvoiceStream";
import type { InvoiceStreamEvent } from "@/hooks/useInvoiceStream";
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
import InvoiceShareQRModal from "@/components/InvoiceShareQRModal";
import VotingPanel from "@/components/VotingPanel";
import DeadlineExtensionPanel from "@/components/DeadlineExtensionPanel";
import SuccessAnimation from "@/components/SuccessAnimation";
import RecipientPayoutTracker from "@/components/RecipientPayoutTracker";
import CloneLineageTree from "@/components/CloneLineageTree";
import TransferOwnershipModal from "@/components/TransferOwnershipModal";
import StellarErrorBoundary from "@/components/error/StellarErrorBoundary";
import { useStellarQuery } from "@/hooks/useStellarQuery";
import { useRecentInvoices } from "@/hooks/useRecentInvoices";

const POLL_MS = 10_000;

// Extend the SDK Invoice type with vesting fields (not yet in published SDK)
type InvoiceWithVesting = Invoice & {
  vestingCliff?: number;    // unix timestamp (seconds)
  claimed?: string[];       // addresses that have claimed
  extensionVotes?: number;  // current votes to extend deadline
};
import CountdownTimer from "@/components/CountdownTimer";
import SplitCalculator from "@/components/SplitCalculator";
import InvoiceTagEditor from "@/components/invoice/InvoiceTagEditor";
import type { SplitMeta } from "@/hooks/useSplitCalculator";
import type { InstallmentMilestone } from "@/components/invoice/InvoiceView";
import ActivityFeed from "@/components/ActivityFeed";
import InstallmentTracker from "@/components/InstallmentTracker";
import InstallmentPanel from "@/components/InstallmentPanel";
import InvoiceView from "@/components/invoice/InvoiceView";
import CoCreatorPanel from "@/components/CoCreatorPanel";
import PaymentChannelPanel from "@/components/PaymentChannelPanel";
import DisputeTimeline from "@/components/DisputeTimeline";
import ConfidentialPaymentFlow from "@/components/ConfidentialPaymentFlow";
import AuditLogTable from "@/components/AuditLogTable";
import VersionHistory from "@/components/VersionHistory";
import CommentSection from "@/components/CommentSection";
import CommentThread from "@/components/invoice/CommentThread";
import { loadPermissions } from "@/components/CoCreatorPanel";
import InvoiceTimeline from "@/components/InvoiceTimeline";
import InvoiceExportButton from "@/components/InvoiceExportButton";
import ReleaseBanner from "@/components/ReleaseBanner";
import { cancelReminder, setReminder } from "@/lib/reminders";
import { recordCooldown } from "@/lib/cooldown";
import { exportTimelineAsImage } from "@/lib/timelineImageExport";
import { isRetroactiveInvoiceId, getRetroactiveInvoice } from "@/lib/retroactiveInvoices";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { PaymentChannelState } from "@/components/PaymentChannelPanel";
import { useInvoicePresence } from "@/hooks/useInvoicePresence";
import PresenceBar from "@/components/PresenceBar";
import InvoiceSection from "@/components/InvoiceSection";
import AmountDisplay from "@/components/invoice/AmountDisplay";

const RecipientPieChart = dynamic(() => import("@/components/RecipientPieChart"), { ssr: false });
const InvoiceQR = dynamic(() => import("@/components/InvoiceQR"), { ssr: false });
const FlowDiagram = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });

interface Props {
  params: { id: string };
}

/**
 * Invoice detail page — shows status, payment progress, and payment options:
 *   1. Pay with Freighter (native Stellar)
 *   2. Pay from Another Chain (cross-chain bridge via Ethereum / Solana)
 */
const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  Pending: { label: "Pending", color: "bg-yellow-500", icon: "\u23F3" },
  Released: { label: "Released", color: "bg-green-500", icon: "\u2705" },
  Refunded: { label: "Refunded", color: "bg-gray-500", icon: "\u21A9\uFE0F" },
};

function showToast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof window !== "undefined" && (window as any).__toastContainer?.addToast) {
    (window as any).__toastContainer.addToast(message, type);
  }
}

/**
 * Runs a live invoice RPC read for as long as the Pay section is mounted.
 * A genuine child of StellarErrorBoundary — the query's render-phase throw
 * on exhausted failure only propagates to boundaries wrapping this
 * component's own subtree, not to whatever renders InvoiceDetailPage.
 */
function PaySectionRpcGate({ id, children }: { id: string; children: React.ReactNode }) {
  useStellarQuery(() => splitClient.getInvoice(id), [id]);
  return <>{children}</>;
}

/**
 * Invoice detail page — shows status, payment progress, Pay button,
 * reminder system, and webhook configuration (creator only).
 */
export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const { addRecent } = useRecentInvoices();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedSplitMeta, setLoadedSplitMeta] = useState<SplitMeta | null>(null);

  // Live stream
  const {
    invoice: streamInvoice,
    latestEvent,
    isConnected,
    error: streamError,
  } = useInvoiceStream(id);

  // Presence indicators for co-creator awareness
  const {
    presenceRoster,
    currentFocusedSection,
    updateFocusedSection,
  } = useInvoicePresence({
    invoiceId: id,
    userId: publicKey || "anonymous",
    displayName: publicKey ? truncateAddress(publicKey) : "Anonymous",
    enabled: Boolean(publicKey),
  });

  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareQRModal, setShowShareQRModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"freighter" | "walletconnect">("freighter");
  const [amountLocked, setAmountLocked] = useState(false);
  const prevPayAmountRef = useRef("");
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"audit" | "history" | "notes" | "comments">(
    "audit"
  );
  const [payerNonce, setPayerNonce] = useState<bigint | null>(null);

  const prevStatusRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  // Focus restoration refs — track which button opened the most-recently opened modal
  const cancelModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shareModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shareQRModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const payModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const duplicateModalTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Restore focus to the trigger button when each modal closes
  useEffect(() => {
    if (!showShareModal) shareModalTriggerRef.current?.focus();
  }, [showShareModal]);
  useEffect(() => {
    if (!showShareQRModal) shareQRModalTriggerRef.current?.focus();
  }, [showShareQRModal]);
  useEffect(() => {
    if (!showDuplicateModal) duplicateModalTriggerRef.current?.focus();
  }, [showDuplicateModal]);
  useEffect(() => {
    if (!showCancelModal) cancelModalTriggerRef.current?.focus();
  }, [showCancelModal]);
  useEffect(() => {
    if (!showPayModal) payModalTriggerRef.current?.focus();
  }, [showPayModal]);
  const [exportingTimeline, setExportingTimeline] = useState(false);
  const { status: pushStatus, subscribe: subscribeToPush, unsubscribe: unsubscribeFromPush } =
    usePushNotifications(id);
  const [lastFailedPayment, setLastFailedPayment] = useState<{ amount: bigint } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [channelState, setChannelState] = useState<PaymentChannelState | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [previousInvoice, setPreviousInvoice] = useState<Invoice | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [showConfidentialFlow, setShowConfidentialFlow] = useState(false);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [showReleaseBanner, setShowReleaseBanner] = useState(false);

  useEffect(() => {
    if (isRetroactiveInvoiceId(id)) {
      setShowReconnecting(false);
      return;
    }
    if (!isConnected) {
      setShowReconnecting(true);
    } else {
      setShowReconnecting(false);
    }
  }, [isConnected, id]);

  useEffect(() => {
    if (latestEvent?.type === "InvoiceReleased") {
      setShowReleaseBanner(true);
    }
  }, [latestEvent]);

  const isRetroactive = isRetroactiveInvoiceId(id);

  const load = async () => {
    if (isRetroactive) {
      const retro = getRetroactiveInvoice(id);
      if (!retro) throw new Error("Retroactive invoice not found.");
      setInvoice(retro);
      setLoading(false);
      addRecent(id);
      return;
    }
    const inv = await splitClient.getInvoice(id);
    setInvoice(inv);
    addRecent(id);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.splitMeta) setLoadedSplitMeta(json.splitMeta);
      }
    } catch {
      // ignore splitMeta fetch failures; invoice still loads
    }
    setLoading(false);
  };

  useEffect(() => {
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
    if (isRetroactive) {
      load().catch((e) => {
        setError(String(e));
        setLoading(false);
      });
      return;
    }
    load().catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Only fallback load if stream hasn't already provided invoice
    if (!streamInvoice) {
      load().catch((e) => {
        setError(String(e));
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (!publicKey) return;
    // TODO: implement payer nonce
    // import("@/lib/paymentNonce").then(({ getPayerNonce }) =>
    //   getPayerNonce(publicKey).then((n) => setPayerNonce(n)).catch(() => null)
    // ).catch(() => null);
  }, [publicKey]);
  const channelStorageKey = (invoiceId: string, payer: string) => `stellarsplit_channel_${invoiceId}_${payer}`;

  const persistChannelState = (state: PaymentChannelState | null) => {
    if (typeof window === "undefined" || !publicKey) return;
    const key = channelStorageKey(id, publicKey);
    if (!state) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        JSON.stringify({
          invoiceId: state.invoiceId,
          payer: state.payer,
          balance: state.balance.toString(),
          opened: state.opened,
        })
      );
    }
  };

  const loadChannelState = () => {
    if (typeof window === "undefined" || !publicKey) return null;
    const key = channelStorageKey(id, publicKey);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.invoiceId !== id || parsed.payer !== publicKey) return null;
      return {
        invoiceId: parsed.invoiceId,
        payer: parsed.payer,
        balance: BigInt(parsed.balance),
        opened: parsed.opened,
      };
    } catch {
      return null;
    }
  };

  const syncChannelState = (state: PaymentChannelState | null) => {
    setChannelState(state);
    persistChannelState(state);
  };

  useEffect(() => {
    if (!publicKey) return;
    const stored = loadChannelState();
    if (stored) {
      setChannelState(stored);
    }
  }, [id, publicKey]);

  const applyChannelBalance = (amount: bigint) => {
    if (!channelState?.opened || channelState.balance <= 0n) return null;
    const used = amount <= channelState.balance ? amount : channelState.balance;
    const remainingBalance = channelState.balance - used;
    const nextState: PaymentChannelState = {
      ...channelState,
      balance: remainingBalance > 0n ? remainingBalance : 0n,
      opened: remainingBalance > 0n,
    };
    syncChannelState(nextState.opened ? nextState : null);
    return channelState;
  };

  const total = invoice
    ? invoice.recipients.reduce((s, r) => s + r.amount, 0n)
    : 0n;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    const amount = parseAmount(payAmount);
    const clientKey = `opt-${Date.now()}`;
    const originalChannel = channelState;
    const channelUsed = applyChannelBalance(amount);
    setPaymentError(null);
    setPaying(true);

    const originalInvoice = invoice;
    const optimisticPayment = { payer: publicKey, amount };
    const optimisticFunded = invoice.funded + amount;

    setInvoice({
      ...invoice,
      funded: optimisticFunded,
      payments: [...invoice.payments, optimisticPayment],
    });

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
      fetch("/api/cron/funding-thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      }).catch(() => null);
    } catch (err) {
      setInvoice(originalInvoice);
      setPaymentError(err instanceof Error ? err.message : String(err));
      if (channelUsed && originalChannel) {
        syncChannelState(originalChannel);
      }
      setInvoice((prev) => {
        if (!prev) return prev;
        const pending = prev.payments.find((p) => (p as any).clientKey === clientKey);
        if (!pending || !(pending as any).pending) return prev;
        return {
          ...prev,
          funded: prev.funded - pending.amount,
          payments: prev.payments.filter((p) => (p as any).clientKey !== clientKey),
        };
      });
      setError(String(err));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 overflow-x-hidden">
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

  const remaining = total - invoice.funded;
  const status = statusConfig[invoice.status] || { label: invoice.status, color: "bg-gray-500", icon: "⌛" };

  /**
   * The Stellar destination for cross-chain payments is the contract ID.
   * The StellarSplitClient is initialised with NEXT_PUBLIC_CONTRACT_ID, so we
   * read it from the environment the same way stellar.ts does.
   */
  const stellarDestination =
    process.env.NEXT_PUBLIC_CONTRACT_ID ?? invoice.token;

  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 overflow-x-hidden">
      {/* Reconnecting indicator */}
      {showReconnecting && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Reconnecting...</span>
        </div>
      )}

      {/* Release Banner */}
      {showReleaseBanner && (
        <ReleaseBanner
          invoiceId={id}
          onDismiss={() => setShowReleaseBanner(false)}
        />
      )}

      {/* Presence Bar — shows active co-creators */}
      {presenceRoster.length > 0 && (
        <div className="mb-6">
          <PresenceBar presenceRoster={presenceRoster} currentUserId={publicKey || ""} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Invoice #{id}
          </h1>
          {(invoice as any).retroactive ? (
            <span
              role="status"
              aria-label="Status: Fully Paid"
              className="inline-flex items-center gap-1 rounded-full font-semibold text-xs px-2 py-0.5 bg-green-500/20 text-green-400"
            >
              ✓ Fully Paid
            </span>
          ) : (
            <StatusBadge status={invoice.status as any} size="sm" />
          )}
          {(invoice as any).retroactive && (
            <span
              className="inline-flex items-center gap-1 rounded-full font-semibold text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300"
              title={`Imported from transaction ${(invoice as any).sourceTxHash}`}
            >
              Retroactive
            </span>
          )}
          <CopyButton text={id} className="!py-1 !px-2 text-xs" />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`} />
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            ref={shareModalTriggerRef}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            aria-label="Share invoice"
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => setShowDuplicateModal(true)}
            ref={duplicateModalTriggerRef}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
            aria-label="Duplicate invoice"
          >
            Duplicate
          </button>
          <InvoiceExportButton invoice={invoice} total={total} />
          {pushStatus !== "unsupported" && !isRetroactive && (
            <button
              type="button"
              onClick={() => (pushStatus === "active" ? unsubscribeFromPush() : subscribeToPush())}
              disabled={pushStatus === "denied"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                pushStatus === "active"
                  ? "bg-green-800/60 text-green-300 hover:bg-green-800"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              aria-label={pushStatus === "active" ? "Notifications active" : "Enable notifications"}
              title={pushStatus === "denied" ? "Notifications blocked in browser settings" : undefined}
            >
              <span aria-hidden="true">{pushStatus === "active" ? "🔔" : "🔕"}</span>
              {pushStatus === "active" ? "Notifications active" : "Notifications off"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowShareQRModal(true)}
            ref={shareQRModalTriggerRef}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
            aria-label="Share invoice via QR"
          >
            Share via QR
          </button>
          {(invoice as any).confidential && (
            <button
              type="button"
              onClick={() => setShowConfidentialFlow(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
              aria-label="Pay confidentially"
            >
              Pay Confidentially
            </button>
          )}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm transition-colors"
            aria-label="Receipt language"
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
          >
            Print Invoice
          </button>
          {invoice.status === "Pending" && publicKey === invoice.creator && (
            <button
              type="button"
              ref={cancelModalTriggerRef}
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Cancel this invoice"
            >
              Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      <InvoiceTagEditor invoiceId={id} className="mb-6" />

      {/* Details Section */}
      <InvoiceSection
        sectionId="details"
        onFocusChange={updateFocusedSection}
        className="mb-8"
      >
        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Creator</p>
          <p className="text-sm font-mono text-gray-200 truncate" title={invoice.creator}>
            {truncateAddress(invoice.creator, 6)}
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total</p>
          <AmountDisplay amount={total} className="text-2xl font-bold text-white" />
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

      {/* Progress - updates in real-time via useInvoiceStream */}
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
      </InvoiceSection>

      {/* Payments Section */}
      <InvoiceSection
        sectionId="payments"
        onFocusChange={updateFocusedSection}
        className="mb-8"
      >
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
                      <AmountDisplay amount={p.amount} inline />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </InvoiceSection>

      {invoice.status === "Pending" && (
        <div className="flex flex-col gap-6">
          {/* ── Option 1: Pay with Freighter ──────────────────────────── */}
          {publicKey && (
            <form onSubmit={handlePay} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Pay with Freighter</h2>
              <input
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="Amount in USDC"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                aria-label="Amount in USDC"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {txHash && (
                <p className="text-green-400 text-sm">
                  Payment sent! Tx: {txHash.slice(0, 12)}…
                </p>
              )}
              <button
                type="submit"
                disabled={paying}
                className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
              >
                {paying ? "Sending…" : "Pay"}
              </button>
            </form>
          )}

          {/* ── Divider ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 text-gray-600 text-xs">
            <div className="flex-1 border-t border-gray-700" />
            <span>or</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* ── Option 2: Pay from Another Chain ──────────────────────── */}
          <CrossChainPayment
            invoiceId={id}
            stellarDestination={stellarDestination}
          />
        </div>
      )}

      {/* Recipients Section */}
      <InvoiceSection
        sectionId="recipients"
        onFocusChange={updateFocusedSection}
        className="mb-8"
      >
        <RecipientPayoutTracker invoice={invoice} publicKey={publicKey} />
      </InvoiceSection>

      {/* Split Calculator */}
      <SplitCalculator
        splitMeta={loadedSplitMeta ?? ((invoice as any).splitMeta as SplitMeta | undefined)}
        readOnly
      />

      <ActivityFeed
        invoice={{
          ...invoice,
          payments: invoice.payments.filter((p) => !(p as any).pending),
        }}
        previousInvoice={previousInvoice}
      />

      {/* Installment schedule — only shown to payers with a registered plan */}
      {publicKey && loadedSplitMeta?.installments && loadedSplitMeta.installments.length > 0 && (
        <InvoiceView
          invoice={invoice}
          installments={loadedSplitMeta.installments as InstallmentMilestone[]}
          publicKey={publicKey}
          onPaid={async (milestoneId, txHash) => {
            const updated = (loadedSplitMeta.installments || []).map((m) =>
              m.id === milestoneId ? { ...m, status: 'paid', txHash } : m
            );
            const newSplitMeta = { ...loadedSplitMeta, installments: updated } as SplitMeta;
            setLoadedSplitMeta(newSplitMeta);
            try {
              await fetch(`/api/invoices/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ splitMeta: newSplitMeta }),
              });
            } catch {
              // ignore persistence errors
            }
          }}
        />
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
        <StellarErrorBoundary>
        <PaySectionRpcGate id={id}>
        <section aria-labelledby="pay-heading" className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 id="pay-heading" className="text-lg font-semibold">Pay toward this invoice</h2>
            <CooldownBadge expiresAt={cooldownExpiresAt} />
          </div>
          <PaymentMethodSelector onMethodChange={setPaymentMethod} />
          <form onSubmit={handlePay} className="flex flex-col gap-4">
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
        </PaySectionRpcGate>
        </StellarErrorBoundary>
      )}

      {showConfidentialFlow && (invoice as any).confidential && publicKey && (
        <ConfidentialPaymentFlow
          invoiceId={id}
          publicKey={publicKey}
        />
      )}

      {showPayModal && invoice && publicKey && (
        <PayModal
          invoice={invoice}
          total={total}
          publicKey={publicKey}
          onPay={async (amount, email, options, mfaToken) => {
            const result = await splitClient.pay({
              payer: publicKey,
              invoiceId: id,
              amount,
              metadata: mfaToken ? { mfaToken } : undefined,
            });
            fetch("/api/cron/funding-thresholds", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceId: id }),
            }).catch(() => null);
            return result;
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

      {/* Tabbed detail section: Audit Log / History / Notes / Comments */}
      <section className="mb-8">
        <div className="flex gap-1 border-b border-gray-700 mb-4" role="tablist" aria-label="Invoice details">
          {(["audit", "history", "notes", "comments"] as const).map((tab) => {
            const labels: Record<string, string> = {
              audit: "Audit Log",
              history: "History",
              notes: "Notes",
              comments: "Comments",
            };
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
        {activeDetailsTab === "comments" && (
          <CommentThread
            invoiceId={id}
            publicKey={publicKey}
            isCreator={publicKey === invoice.creator}
            coCreatorWritePermission={
              !!publicKey &&
              loadPermissions(id).some(
                (p) => p.address === publicKey && (p.permissionLevel === "edit" || p.permissionLevel === "admin")
              )
            }
          />
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
          onClose={() => {
            setShowCancelModal(false);
            // focus restored by useEffect watching showCancelModal
          }}
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

      <InvoiceShareQRModal
        open={showShareQRModal}
        invoiceId={id}
        onClose={() => setShowShareQRModal(false)}
      />
    </main>
  );
}