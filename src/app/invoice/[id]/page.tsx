"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { getSimulationMode } from "@/lib/simulationMode";
import {
  isSubscribedToInvoice,
  notifyInvoiceReleased,
  requestNotificationPermission,
  subscribeToInvoice,
} from "@/lib/notifications";
import { formatAmount, parseAmount, truncateAddress } from "@stellar-split/sdk";
import { useInvoiceCustomization } from "@/lib/customization";
import type { Locale } from "@/lib/i18n";
import PaymentSuggestions from "@/components/PaymentSuggestions";
import PaymentProgress from "@/components/PaymentProgress";
import PayModal from "@/components/PayModal";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import PaymentChannelPanel from "@/components/PaymentChannelPanel";
import CoCreatorPanel from "@/components/CoCreatorPanel";
import AuditLogTable from "@/components/AuditLogTable";
import DisputeTimeline from "@/components/DisputeTimeline";
import CountdownTimer from "@/components/CountdownTimer";
import RecipientPieChart from "@/components/RecipientPieChart";
import InvoicePDF from "@/components/InvoicePDF";
import PaymentCertificate from "@/components/PaymentCertificate";
import PaymentExport from "@/components/PaymentExport";
import AchievementCard from "@/components/AchievementCard";
import PaymentSourceBar from "@/components/PaymentSourceBar";
import ReputationBadge from "@/components/ReputationBadge";
import VerifiedCreatorBadge from "@/components/VerifiedCreatorBadge";
import VersionHistory from "@/components/VersionHistory";
import InstallmentPanel from "@/components/InstallmentPanel";
import InstallmentTracker from "@/components/InstallmentTracker";
import CommentSection from "@/components/CommentSection";
import StatusTimeline from "@/components/StatusTimeline";
import EscrowPanel from "@/components/EscrowPanel";
import ActivityFeed from "@/components/ActivityFeed";
import VelocityChart from "@/components/VelocityChart";
import VestingTimeline from "@/components/VestingTimeline";
import PresenceIndicators from "@/components/PresenceIndicators";
import CollaborationCursors from "@/components/CollaborationCursors";
import SplitCalculator from "@/components/SplitCalculator";
import InvoiceQR from "@/components/InvoiceQR";
import InvoiceChat from "@/components/InvoiceChat";
import { getReminderForInvoice, cancelReminder, setReminder } from "@/lib/reminders";
import { sendWebhookIfConfigured } from "@/components/WebhookConfig";
import TxConfirmModal from "@/components/TxConfirmModal";
import CancelModal from "@/components/CancelModal";
import DuplicateModal from "@/components/DuplicateModal";
import CopyLinkButton from "@/components/CopyLinkButton";
import VotingPanel from "@/components/VotingPanel";
import FlowDiagram from "@/components/FlowDiagram";
import SuccessAnimation from "@/components/SuccessAnimation";
import type { Invoice, Payment } from "@stellar-split/sdk";
import CooldownBadge from "@/components/CooldownBadge";
import { fetchCooldownExpiry, recordCooldown, clearCooldown } from "@/lib/cooldown";
import PaymentSummaryCard from "@/components/PaymentSummaryCard";
import CloneLineageTree from "@/components/CloneLineageTree";
import { exportTimelineAsImage } from "@/lib/timelineImageExport";
import { getOrAssignDisplayNumber } from "@/lib/invoiceNumbering";

const POLL_MS = 10_000;

// Extend the SDK Invoice type with vesting fields (not yet in published SDK)
type InvoiceWithVesting = Invoice & {
  vestingCliff?: number;    // unix timestamp (seconds)
  claimed?: string[];       // addresses that have claimed
  extensionVotes?: number;  // current votes to extend deadline
};

interface Props {
  params: { id: string };
}

type InvoicePayment = Payment & { pending?: boolean; clientKey?: string };
type InvoiceView = Omit<InvoiceWithVesting, "payments"> & { payments: InvoicePayment[] };

type PaymentChannelState = {
  invoiceId: string;
  payer: string;
  balance: bigint;
  opened: boolean;
};

function mergeWithServer(server: Invoice, local: InvoiceView | null): InvoiceView {
  const pending = (local?.payments ?? []).filter((p) => p.pending);
  const unmatchedPending = pending.filter(
    (p) =>
      !server.payments.some((sp) => sp.payer === p.payer && sp.amount === p.amount)
  );
  return {
    ...server,
    payments: [...server.payments, ...unmatchedPending],
    funded:
      server.funded + unmatchedPending.reduce((sum, p) => sum + p.amount, 0n),
  };
}

/**
 * Invoice detail page — shows status, payment progress, Pay button,
 * reminder system, and webhook configuration (creator only).
 */
export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const customization = useInvoiceCustomization(id);
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [previousInvoice, setPreviousInvoice] = useState<Invoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [channelState, setChannelState] = useState<PaymentChannelState | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Payment retry state
  const [lastFailedPayment, setLastFailedPayment] = useState<{ amount: bigint; fee?: bigint } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [estimatedFee, setEstimatedFee] = useState<bigint | null>(null);

  // Reminder state
  const [reminderDate, setReminderDate] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderSaved, setReminderSaved] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifyDenied, setNotifyDenied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"freighter" | "walletconnect">("freighter");
  const [amountLocked, setAmountLocked] = useState(false);
  const prevPayAmountRef = useRef("");
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);

  const prevStatusRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exportingTimeline, setExportingTimeline] = useState(false);

  useEffect(() => {
    setNotifySubscribed(isSubscribedToInvoice(id));
  }, [id]);

  const handleNotifyMe = async () => {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      setNotifyDenied(true);
      return;
    }
    subscribeToInvoice(id);
    setNotifySubscribed(true);
    setNotifyDenied(false);
  };

  const load = async () => {
    const inv = await splitClient.getInvoice(id);

    // Fire webhook if status changed
    if (prevStatusRef.current && prevStatusRef.current !== inv.status) {
      await sendWebhookIfConfigured(id, {
        invoiceId: id,
        previousStatus: prevStatusRef.current,
        newStatus: inv.status,
        timestamp: new Date().toISOString(),
      });
      if (inv.status === "Released") {
        setShowAchievement(true);
      }
    }
    prevStatusRef.current = inv.status;

    setInvoice((current) => {
      if (current) {
        setPreviousInvoice({
          id: current.id,
          creator: current.creator,
          recipients: current.recipients,
          token: current.token,
          deadline: current.deadline,
          funded: current.funded,
          status: current.status,
          payments: current.payments.filter((p) => !p.pending),
        });
      }
      return mergeWithServer(inv, current);
    });
  };

  const loadCooldown = async (wallet: string) => {
    const expiry = await fetchCooldownExpiry(id, wallet);
    setCooldownExpiresAt(expiry);
  };

  const channelStorageKey = (invoiceId: string, payer: string) =>
    `payment-channel-${invoiceId}-${payer}`;

  const persistChannelState = (state: PaymentChannelState | null) => {
    if (typeof window === "undefined") return;
    const key = channelStorageKey(id, publicKey ?? "");
    if (!state) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        invoiceId: state.invoiceId,
        payer: state.payer,
        balance: state.balance.toString(),
        opened: state.opened,
      })
    );
  };

  const loadChannelState = () => {
    if (typeof window === "undefined" || !publicKey) return null;
    const raw = localStorage.getItem(channelStorageKey(id, publicKey));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        invoiceId: string;
        payer: string;
        balance: string | number;
        opened: boolean;
      };

      if (parsed.invoiceId !== id || parsed.payer !== publicKey) return null;
      return {
        invoiceId: parsed.invoiceId,
        payer: parsed.payer,
        balance: BigInt(parsed.balance),
        opened: parsed.opened,
      } as PaymentChannelState;
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

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    getFreighterPublicKey()
      .then((key) => {
        setPublicKey(key);
        if (key) loadCooldown(key);
      })
      .catch(() => null);

    // Load existing reminder
    const existing = getReminderForInvoice(id);
    if (existing) {
      setHasReminder(true);
      setReminderDate(existing.reminderDate.slice(0, 16)); // datetime-local format
      setReminderMsg(existing.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (invoice?.status === "Released" || invoice?.status === "Refunded") {
      return;
    }

    const pollId = setInterval(() => {
      load().catch((e) => setError(String(e)));
    }, POLL_MS);

    return () => clearInterval(pollId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, invoice?.status]);

  const total = invoice
    ? invoice.recipients.reduce((s, r) => s + r.amount, 0n)
    : 0n;

  // Keep locked amount in sync with the latest remaining balance after each poll
  useEffect(() => {
    if (amountLocked && invoice) {
      const remaining = invoice.recipients.reduce((s, r) => s + r.amount, 0n) - invoice.funded;
      setPayAmount(formatAmount(remaining > 0n ? remaining : 0n));
    }
  }, [amountLocked, invoice]);

  const applyChannelBalance = (amount: bigint) => {
    if (!channelState?.opened || channelState.balance <= 0n) return null;
    const used = amount <= channelState.balance ? amount : channelState.balance;
    const remaining = channelState.balance - used;
    const nextState: PaymentChannelState = {
      ...channelState,
      balance: remaining > 0n ? remaining : 0n,
      opened: remaining > 0n,
    };
    syncChannelState(nextState.opened ? nextState : null);
    return channelState;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    const amount = parseAmount(payAmount);
    const clientKey = `opt-${Date.now()}`;
    const originalChannel = channelState;
    const channelUsed = applyChannelBalance(amount);
    setError(null);
    setInvoice((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        funded: prev.funded + amount,
        payments: [
          ...prev.payments,
          { payer: publicKey, amount, pending: true, clientKey },
        ],
      };
    });
    setPaying(true);
    try {
      const result = await splitClient.pay({
        payer: publicKey,
        invoiceId: id,
        amount,
      });
      setTxHash(result.txHash);
      setShowSuccess(true);
      setLastFailedPayment(null);
      setRetryCount(0);
      try {
        const existing = JSON.parse(localStorage.getItem("stellarsplit_adapter_usage") ?? "[]");
        existing.push({ adapter: paymentMethod, timestamp: Date.now() });
        localStorage.setItem("stellarsplit_adapter_usage", JSON.stringify(existing));
      } catch { /* ignore storage errors */ }
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      if (publicKey) {
        const expiry = recordCooldown(id, publicKey);
        setCooldownExpiresAt(expiry);
      }
      await load();
    } catch (err) {
      if (channelUsed && originalChannel) {
        syncChannelState(originalChannel);
      }
      setInvoice((prev) => {
        if (!prev) return prev;
        const pending = prev.payments.find((p) => p.clientKey === clientKey);
        if (!pending?.pending) return prev;
        return {
          ...prev,
          funded: prev.funded - pending.amount,
          payments: prev.payments.filter((p) => p.clientKey !== clientKey),
        };
      });
      setError(String(err));
      setLastFailedPayment({ amount });
      setRetryCount((prev) => prev + 1);
    } finally {
      setPaying(false);
    }
  };

  const payWithChannel = async (amount: bigint, email?: string) => {
    if (!publicKey) return;
    const originalChannel = channelState;
    const channelUsed = applyChannelBalance(amount);
    try {
      const result = await splitClient.pay({ payer: publicKey, invoiceId: id, amount });
      setTxHash(result.txHash);
      if (email) {
        try {
          await fetch("/api/send-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              invoiceId: id,
              txHash: result.txHash,
              amount: formatAmount(amount),
            }),
          });
        } catch (err) {
          console.error("Failed to send confirmation email:", err);
        }
      }
      await load();
      return result;
    } catch (err) {
      if (channelUsed && originalChannel) {
        syncChannelState(originalChannel);
      }
      throw err;
    }
  };

  const handleSetReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDate) return;
    setReminder({
      invoiceId: id,
      reminderDate: new Date(reminderDate).toISOString(),
      message: reminderMsg || `Invoice #${id} payment reminder`,
    });
    setHasReminder(true);
    setReminderSaved(true);
    // Request notification permission proactively
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const handleExportTimeline = async () => {
    if (!timelineRef.current || !invoice) return;
    setExportingTimeline(true);
    try {
      await exportTimelineAsImage(timelineRef.current, id, invoice.status);
    } finally {
      setExportingTimeline(false);
    }
  };

  const handleCancelReminder = () => {
    cancelReminder(id);
    setHasReminder(false);
    setReminderDate("");
    setReminderMsg("");
    setReminderSaved(false);
  };

  const handleCancelInvoice = async () => {
    await (splitClient as any).cancelInvoice(id);
    await load();
    setShowCancelModal(false);
  };

  const handleTransferOwnership = async (newOwner: string) => {
    setTransferError(null);
    await (splitClient as any).forwardInvoice({ invoiceId: id, newOwner });
    await load();
    setShowTransferModal(false);
  };

  const handleRetryPayment = async () => {
    if (!lastFailedPayment || !publicKey) return;
    setError(null);
    setPaying(true);
    try {
      const result = await splitClient.pay({
        payer: publicKey,
        invoiceId: id,
        amount: lastFailedPayment.amount,
      });
      setTxHash(result.txHash);
      setShowSuccess(true);
      setLastFailedPayment(null);
      setRetryCount(0);
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      if (publicKey) {
        const expiry = recordCooldown(id, publicKey);
        setCooldownExpiresAt(expiry);
      }
      await load();
    } catch (err) {
      setError(String(err));
      setRetryCount((prev) => prev + 1);
    } finally {
      setPaying(false);
    }
  };

  // Interval-driven cooldown expiry: re-enable the pay button the moment
  // the cooldown timestamp passes, without requiring a page refresh or chain poll.
  useEffect(() => {
    if (!cooldownExpiresAt || !publicKey) return;
    const msUntilExpiry = cooldownExpiresAt * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      setCooldownExpiresAt(null);
      clearCooldown(id, publicKey);
      return;
    }
    const timer = setTimeout(() => {
      setCooldownExpiresAt(null);
      if (publicKey) clearCooldown(id, publicKey);
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [cooldownExpiresAt, id, publicKey]);

  if (error && !invoice) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-red-400" role="alert">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-gray-400" aria-live="polite">Loading invoice…</p>
      </main>
    );
  }

  const isCreator = publicKey === invoice.creator;

  const statusColor: Record<string, string> = {
    Pending: "bg-yellow-500",
    Released: "bg-green-500",
    Refunded: "bg-gray-500",
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <PresenceIndicators invoiceId={id} currentAddress={publicKey} />
      <CollaborationCursors invoiceId={id} currentAddress={publicKey} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {customization?.title ? customization.title : `Invoice #${id}`}
          </h1>
          {(() => {
            const dn = getOrAssignDisplayNumber(id);
            return dn ? (
              <span className="text-sm font-mono text-indigo-400 self-end mb-1">({dn})</span>
            ) : null;
          })()}
          <VerifiedCreatorBadge address={invoice.creator} />
        </div>

      <div className="mb-6">
        <FlowDiagram invoice={invoice} />
      </div>

      <CloneLineageTree invoiceId={id} />
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${statusColor[invoice.status]}`}
          aria-label={`Status: ${invoice.status}`}
        >
          {invoice.status}
        </span>
        <div className="ml-auto flex items-center gap-2 print:hidden flex-wrap justify-end">
          <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`} />
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
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
          >
            Print Invoice
          </button>
        </div>
        {invoice.status === "Released" && (
          <button
            type="button"
            onClick={() => window.print()}
            className="sm:ml-auto min-h-11 px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm transition-colors print:hidden self-start sm:self-auto"
          >
            Download Certificate
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="sm:ml-auto min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors print:hidden self-start sm:self-auto"
        >
          Print Invoice
        </button>
        {isCreator && (
          <button
            type="button"
            onClick={() => setShowDuplicateModal(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-sm transition-colors print:hidden"
          >
            Duplicate
          </button>
        )}
        {isCreator && invoice.status === "Pending" && (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-sm transition-colors print:hidden"
          >
            Cancel Invoice
          </button>
        )}
        {isCreator && invoice.status === "Pending" && invoice.funded === 0n && (
          <button
            type="button"
            onClick={() => setShowTransferModal(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm transition-colors print:hidden"
          >
            Transfer Ownership
          </button>
        )}
      </div>

      {/* Invoice PDF — print-only */}
      <InvoicePDF invoice={invoice} total={total} locale={locale} />

      {/* Status Timeline */}
      <div ref={timelineRef}>
        <StatusTimeline invoice={invoice} total={total} />
      </div>
      <div className="flex justify-end mb-8 print:hidden">
        <button
          type="button"
          onClick={handleExportTimeline}
          disabled={exportingTimeline}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {exportingTimeline ? "Exporting…" : "Export as image"}
        </button>
      </div>

      {/* Escrow Panel */}
      <EscrowPanel invoice={invoice} total={total} />

      {/* Custom Message */}
      {customization?.message && (
        <section className="mb-8 p-4 rounded-lg border-l-4" style={{ borderColor: customization.accentColor, backgroundColor: `${customization.accentColor}15` }}>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{customization.message}</p>
        </section>
      )}

      {/* Vesting Timeline — only shown when vestingCliff is set */}
      {invoice.vestingCliff && (
        <VestingTimeline
          invoiceId={id}
          vestingCliff={invoice.vestingCliff}
          claimed={invoice.claimed ?? []}
          publicKey={publicKey}
        />
      )}

      {/* Live payment summary with aggregator, leaderboard, and mini bar chart */}
      <PaymentSummaryCard invoiceId={id} />

      {/* Progress */}
      <section aria-labelledby="progress-heading" className="mb-8">
        <h2 id="progress-heading" className="sr-only">Payment Progress</h2>
        <PaymentProgress funded={invoice.funded} total={total} />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
          {channelState?.opened && (
            <span className="text-indigo-300 ml-2">
              · Channel balance: {formatAmount(channelState.balance)} USDC
            </span>
          )}
        </p>
        {invoice.deadline > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-400">Time remaining:</span>
            <CountdownTimer deadline={invoice.deadline} />
          </div>
        )}
      </section>

      {/* QR Code */}
      <InvoiceQR invoiceId={id} />

      {/* Release notifications */}
      <section className="mb-8">
        <button
          type="button"
          onClick={handleNotifyMe}
          disabled={notifySubscribed}
          className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-700 hover:border-indigo-500 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          {notifySubscribed ? "Notifications enabled" : "Notify me"}
        </button>
        {notifyDenied && (
          <p className="text-gray-400 text-sm mt-2">
            Notifications are blocked. Enable them in your browser settings to get
            alerts when this invoice is released.
          </p>
        )}
      </section>

      {/* Payments */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Payments ({invoice.payments.length})
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-gray-500 text-sm">No payments yet.</p>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Payment Sources</h3>
              <PaymentSourceBar
                payments={invoice.payments.filter((p) => !p.pending)}
                total={total}
              />
            </div>
            <ul className="flex flex-col gap-2">
              {invoice.payments.map((p, i) => (
                <li
                  key={p.clientKey ?? `${p.payer}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm"
                >
                  <span className="font-mono text-gray-300 truncate max-w-[55%]">
                    {p.payer}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-indigo-300">{formatAmount(p.amount)} USDC</span>
                    {p.pending && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full">
                        <span
                          className="inline-block h-3 w-3 rounded-full border-2 border-amber-300 border-t-transparent animate-spin"
                          aria-hidden
                        />
                        Confirming…
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Payment Export */}
      <section className="mb-8">
        <PaymentExport
          invoiceId={id}
          payments={invoice.payments.filter((p) => !p.pending)}
        />
      </section>

      {/* Invoice Chat */}
      <InvoiceChat
        invoiceId={id}
        creator={invoice.creator}
        recipients={invoice.recipients}
        currentAddress={publicKey}
      />

      {/* Recipients */}
      <section aria-labelledby="recipients-heading" className="mb-8">
        <h2 id="recipients-heading" className="text-lg font-semibold mb-3">Recipients</h2>
        <RecipientPieChart recipients={invoice.recipients} total={total} />
        <ul className="flex flex-col gap-2 mt-4">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm min-w-0 items-center"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono text-gray-300 min-w-0 shrink" title={r.address}>
                  <span className="sm:hidden">{truncateAddress(r.address)}</span>
                  <span className="hidden sm:inline truncate">{r.address}</span>
                </span>
                <ReputationBadge address={r.address} />
              </div>
              <span className="text-indigo-300 shrink-0">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Split Calculator */}
      {invoice.status === "Pending" && <SplitCalculator invoice={invoice} />}

      <ActivityFeed
        invoice={{
          ...invoice,
          payments: invoice.payments.filter((p) => !p.pending),
        }}
        previousInvoice={previousInvoice}
      />

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

      {/* Co-Creator Management — only shown to primary creator */}
      {publicKey && (
        <CoCreatorPanel invoice={invoice} publicKey={publicKey} onUpdate={load} />
      )}

      {/* Payment channel panel for frequent payers */}
      {invoice.status === "Pending" && publicKey && publicKey !== invoice.creator && (
        <PaymentChannelPanel
          invoiceId={id}
          publicKey={publicKey}
          channelState={channelState}
          onOpen={async () => {
            if (!publicKey) return;
            setChannelLoading(true);
            setChannelError(null);
            try {
              const result = await (splitClient as any).openChannel({ payer: publicKey, invoiceId: id });
              const balance = result?.balance != null ? BigInt(result.balance) : 0n;
              syncChannelState({ invoiceId: id, payer: publicKey, balance, opened: true });
              await load();
            } catch (err) {
              setChannelError(String(err));
            } finally {
              setChannelLoading(false);
            }
          }}
          onClose={async () => {
            if (!publicKey) return;
            setChannelLoading(true);
            setChannelError(null);
            try {
              await (splitClient as any).closeChannel({ payer: publicKey, invoiceId: id });
              syncChannelState(null);
              await load();
            } catch (err) {
              setChannelError(String(err));
            } finally {
              setChannelLoading(false);
            }
          }}
          loading={channelLoading}
          error={channelError}
        />
      )}

      {/* Pay button → opens modal */}
      {invoice.status === "Pending" && publicKey && (
        <section aria-labelledby="pay-heading" className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 id="pay-heading" className="text-lg font-semibold">Pay toward this invoice</h2>
            <CooldownBadge expiresAt={cooldownExpiresAt} />
          </div>
          <PaymentMethodSelector
            onMethodChange={setPaymentMethod}
            payerAddress={publicKey ?? undefined}
            recipientAddress={invoice.recipients[0]?.address}
          />
          <form onSubmit={handlePay} className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-300">
                  Amount (USDC)
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs text-gray-400">Pay exact remaining</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={amountLocked}
                    onClick={() => {
                      if (!amountLocked) {
                        prevPayAmountRef.current = payAmount;
                        const remaining = total - invoice.funded;
                        setPayAmount(formatAmount(remaining > 0n ? remaining : 0n));
                      } else {
                        setPayAmount(prevPayAmountRef.current);
                      }
                      setAmountLocked((v) => !v);
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${amountLocked ? "bg-indigo-600" : "bg-gray-600"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${amountLocked ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                </label>
              </div>
              <input
                id="pay-amount"
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="Amount in USDC"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                disabled={amountLocked}
                readOnly={amountLocked}
                className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
                aria-describedby={error ? "pay-error" : undefined}
              />
              <PaymentSuggestions
                invoice={invoice}
                total={total}
                publicKey={publicKey}
                onSuggest={setPayAmount}
              />
              {channelState?.opened && channelState.balance > 0n && (
                <p className="text-sm text-gray-400 mt-2">
                  This payment will use up to <span className="text-indigo-300">{formatAmount(channelState.balance)} USDC</span> from your open payment channel.
                </p>
              )}
            </div>
            {error && (
              <div id="pay-error" role="alert" className="flex flex-col gap-2">
                <p className="text-red-400 text-sm">{error}</p>
                {lastFailedPayment && retryCount < 3 && (
                  <button
                    type="button"
                    onClick={handleRetryPayment}
                    disabled={paying}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {paying ? "Retrying…" : `Retry Payment (${retryCount}/3)`}
                  </button>
                )}
                {retryCount >= 3 && (
                  <p className="text-amber-400 text-sm">
                    Max retries reached. Please refresh the page and try again.
                  </p>
                )}
              </div>
            )}
            {txHash && (
              <p role="status" className="text-green-400 text-sm">
                Payment sent! Tx: {txHash.slice(0, 12)}…
              </p>
            )}
            <button
              type="submit"
              disabled={paying || !!cooldownExpiresAt}
              aria-disabled={paying || !!cooldownExpiresAt}
              aria-label={
                cooldownExpiresAt
                  ? `Pay — cooldown active, next payment available after cooldown expires`
                  : paying
                  ? "Sending payment…"
                  : "Pay"
              }
              className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paying ? "Sending…" : "Pay"}
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
            await payWithChannel(amount, email);
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
      {(invoice as any).disputeStatus && (
        <DisputeTimeline
          invoiceId={id}
          disputeStatus={(invoice as any).disputeStatus}
        />
      )}

      {/* Audit Log */}
      <AuditLogTable invoiceId={id} />

      {/* Private notes — only visible to the connected wallet */}
      {publicKey && (
        <CommentSection invoiceId={id} walletAddress={publicKey} />
      )}
      

      {showCancelModal && invoice && (
        <CancelModal
          invoiceId={id}
          payments={invoice.payments}
          onConfirm={handleCancelInvoice}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showDuplicateModal && (
        <DuplicateModal
          invoiceId={id}
          onConfirm={(deadlineIso) => {
            setShowDuplicateModal(false);
            const params = new URLSearchParams({ from: id, deadline: deadlineIso });
            router.push(`/invoice/new?${params.toString()}`);
          }}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

      {showTransferModal && (
        <TransferOwnershipModal
          invoiceId={id}
          onConfirm={handleTransferOwnership}
          onClose={() => { setShowTransferModal(false); setTransferError(null); }}
        />
      )}

      {transferError && (
        <p role="alert" className="text-red-400 text-sm mt-2">{transferError}</p>
      )}

      {invoice.status === "Released" && (
        <PaymentCertificate
          invoice={invoice}
          total={total}
          verifyUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`}
        />
      )}

      {showAchievement && (
        <AchievementCard
          invoiceId={id}
          totalAmount={formatAmount(total)}
          onDismiss={() => setShowAchievement(false)}
        />
      )}

      {showSuccess && txHash && (
        <SuccessAnimation
          invoiceId={id}
          txHash={txHash}
          onDismiss={() => setShowSuccess(false)}
        />
      )}
    </main>
  );
}