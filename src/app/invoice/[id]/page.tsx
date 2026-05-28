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
import PaymentProgress from "@/components/PaymentProgress";
import PayModal from "@/components/PayModal";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import CoCreatorPanel from "@/components/CoCreatorPanel";
import AuditLogTable from "@/components/AuditLogTable";
import CountdownTimer from "@/components/CountdownTimer";
import RecipientPieChart from "@/components/RecipientPieChart";
import InvoicePDF from "@/components/InvoicePDF";
import PaymentCertificate from "@/components/PaymentCertificate";
import PaymentSourceBar from "@/components/PaymentSourceBar";
import VersionHistory from "@/components/VersionHistory";
import InstallmentPanel from "@/components/InstallmentPanel";
import InstallmentTracker from "@/components/InstallmentTracker";
import CommentSection from "@/components/CommentSection";
import StatusTimeline from "@/components/StatusTimeline";
import ActivityFeed from "@/components/ActivityFeed";
import VestingTimeline from "@/components/VestingTimeline";
import PresenceIndicators from "@/components/PresenceIndicators";
import SplitCalculator from "@/components/SplitCalculator";
import InvoiceQR from "@/components/InvoiceQR";
import { getReminderForInvoice, cancelReminder, setReminder } from "@/lib/reminders";
import { sendWebhookIfConfigured } from "@/components/WebhookConfig";
import TxConfirmModal from "@/components/TxConfirmModal";
import CancelModal from "@/components/CancelModal";
import CopyLinkButton from "@/components/CopyLinkButton";
import VotingPanel from "@/components/VotingPanel";
import VerifiedCreatorBadge from "@/components/VerifiedCreatorBadge";
import type { Invoice } from "@stellar-split/sdk";
import type { Invoice, Payment } from "@stellar-split/sdk";

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
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [previousInvoice, setPreviousInvoice] = useState<Invoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");

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

  const prevStatusRef = useRef<string | null>(null);

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

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    getFreighterPublicKey().then(setPublicKey).catch(() => null);

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

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    const amount = parseAmount(payAmount);
    const clientKey = `opt-${Date.now()}`;
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
      setLastFailedPayment(null);
      setRetryCount(0);
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      await load();
    } catch (err) {
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
      setLastFailedPayment(null);
      setRetryCount(0);
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      await load();
    } catch (err) {
      setError(String(err));
      setRetryCount((prev) => prev + 1);
    } finally {
      setPaying(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {customization?.title ? customization.title : `Invoice #${id}`}
          </h1>
          <VerifiedCreatorBadge address={invoice.creator} />
        </div>
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
            onClick={() => router.push(`/invoice/new?from=${id}`)}
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
      </div>

      {/* Invoice PDF — print-only */}
      <InvoicePDF invoice={invoice} total={total} locale={locale} />

      {/* Status Timeline */}
      <StatusTimeline invoice={invoice} total={total} />

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

      {/* Progress */}
      <section aria-labelledby="progress-heading" className="mb-8">
        <h2 id="progress-heading" className="sr-only">Payment Progress</h2>
        <PaymentProgress funded={invoice.funded} total={total} />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
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

      {/* Pay button → opens modal */}
      {invoice.status === "Pending" && publicKey && (
        <section aria-labelledby="pay-heading" className="mb-8">
          <h2 id="pay-heading" className="text-lg font-semibold mb-4">Pay toward this invoice</h2>
          <PaymentMethodSelector onMethodChange={setPaymentMethod} />
          <form onSubmit={handlePay} className="flex flex-col gap-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-300 mb-1">
                Amount (USDC)
              </label>
              <input
                id="pay-amount"
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="Amount in USDC"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-describedby={error ? "pay-error" : undefined}
              />
              <PaymentSuggestions
                invoice={invoice}
                total={total}
                publicKey={publicKey}
                onSuggest={setPayAmount}
              />
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
              disabled={paying}
              className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
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
            const result = await splitClient.pay({ payer: publicKey, invoiceId: id, amount });
            setTxHash(result.txHash);
            
            // Send confirmation email if provided
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
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {invoice.status !== "Pending" && (
        <p className="text-gray-400 text-sm mb-8">
          This invoice is {invoice.status.toLowerCase()} and no longer accepts payments.
        </p>
      )}

      {/* Audit Log */}
      <AuditLogTable invoiceId={id} />

      {/* Private notes — only visible to the connected wallet */}
      {publicKey && (
        <CommentSection invoiceId={id} walletAddress={publicKey} />
      )}
        </>
      )}

      {showCancelModal && invoice && (
        <CancelModal
          invoiceId={id}
          payments={invoice.payments}
          onConfirm={handleCancelInvoice}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {invoice.status === "Released" && (
        <PaymentCertificate
          invoice={invoice}
          total={total}
          verifyUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${id}`}
        />
      )}
    </main>
  );
}