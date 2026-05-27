"use client";

import { useEffect, useRef, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import InstallmentPanel from "@/components/InstallmentPanel";
import CommentSection from "@/components/CommentSection";
import StatusTimeline from "@/components/StatusTimeline";
import VestingTimeline from "@/components/VestingTimeline";
import { getReminderForInvoice, cancelReminder, setReminder } from "@/lib/reminders";
import { sendWebhookIfConfigured } from "@/components/WebhookConfig";
import type { Invoice } from "@stellar-split/sdk";

// Extend the SDK Invoice type with vesting fields (not yet in published SDK)
type InvoiceWithVesting = Invoice & {
  vestingCliff?: number; // unix timestamp (seconds)
  claimed?: string[];    // addresses that have claimed
};

interface Props {
  params: { id: string };
}

/**
 * Invoice detail page — shows status, payment progress, Pay button,
 * reminder system, and webhook configuration (creator only).
 */
export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const [invoice, setInvoice] = useState<InvoiceWithVesting | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // Reminder state
  const [reminderDate, setReminderDate] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderSaved, setReminderSaved] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);

  const prevStatusRef = useRef<string | null>(null);

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

    setInvoice(inv);
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
  }, [id]);

  useEffect(() => {
    if (invoice?.status === "Released" || invoice?.status === "Refunded") {
      return;
    }

    const interval = setInterval(() => {
      splitClient
        .getInvoice(id)
        .then(setInvoice)
        .catch(() => {});
    }, 10_000);

    return () => clearInterval(interval);
  }, [id, invoice?.status]);

  const total = invoice
    ? invoice.recipients.reduce((s, r) => s + r.amount, 0n)
    : 0n;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    setError(null);
    setPaying(true);
    try {
      const result = await splitClient.pay({
        payer: publicKey,
        invoiceId: id,
        amount: parseAmount(payAmount),
      });
      setTxHash(result.txHash);
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
      await load();
    } catch (err) {
      setError(String(err));
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

  if (error && !invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-red-400" role="alert">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
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
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-3xl font-bold">Invoice #{id}</h1>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${statusColor[invoice.status]}`}
          aria-label={`Status: ${invoice.status}`}
        >
          {invoice.status}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors print:hidden"
        >
          Print Invoice
        </button>
      </div>

      {/* Status Timeline */}
      <StatusTimeline invoice={invoice} total={total} />

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
        <p className="text-sm text-gray-400 mt-1">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
        </p>
      </section>

      {/* Recipients */}
      <section aria-labelledby="recipients-heading" className="mb-8">
        <h2 id="recipients-heading" className="text-lg font-semibold mb-3">Recipients</h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between bg-gray-900 rounded-lg px-4 py-2 text-sm"
            >
              <span className="font-mono text-gray-300 truncate max-w-[60%]" title={r.address}>
                {r.address}
              </span>
              <span className="text-indigo-300">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Installment schedule — only shown to payers with a registered plan */}
      {publicKey && (
        <InstallmentPanel invoiceId={id} publicKey={publicKey} />
      )}

      {/* Pay form */}
      {invoice.status === "Pending" && publicKey && (
        <section aria-labelledby="pay-heading" className="mb-8">
          <form onSubmit={handlePay} className="flex flex-col gap-4">
            <h2 id="pay-heading" className="text-lg font-semibold">Pay toward this invoice</h2>
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-describedby={error ? "pay-error" : undefined}
              />
            </div>
            {error && <p id="pay-error" role="alert" className="text-red-400 text-sm">{error}</p>}
            {txHash && (
              <p role="status" className="text-green-400 text-sm">
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
        </section>
      )}

      {invoice.status !== "Pending" && (
        <p className="text-gray-400 text-sm mb-8">
          This invoice is {invoice.status.toLowerCase()} and no longer accepts payments.
        </p>
      )}

      {/* Private notes — only visible to the connected wallet */}
      {publicKey && (
        <CommentSection invoiceId={id} walletAddress={publicKey} />
      )}
    </main>
  );
}
