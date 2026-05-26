"use client";

import { useEffect, useRef, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import {
  isSubscribedToInvoice,
  notifyInvoiceReleased,
  requestNotificationPermission,
  subscribeToInvoice,
} from "@/lib/notifications";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import type { Invoice, Payment } from "@stellar-split/sdk";

interface Props {
  params: { id: string };
}

type InvoicePayment = Payment & { pending?: boolean; clientKey?: string };
type InvoiceView = Omit<Invoice, "payments"> & { payments: InvoicePayment[] };

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
 * Invoice detail page — shows status, payment progress, and a Pay button.
 */
export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifyDenied, setNotifyDenied] = useState(false);
  const prevStatusRef = useRef<Invoice["status"] | null>(null);

  const load = async () => {
    const inv = await splitClient.getInvoice(id);
    setInvoice((prev) => mergeWithServer(inv, prev));
    prevStatusRef.current = inv.status;
  };

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
    setNotifySubscribed(isSubscribedToInvoice(id));
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => {
      splitClient
        .getInvoice(id)
        .then((inv) => {
          const prev = prevStatusRef.current;
          if (
            prev === "Pending" &&
            inv.status === "Released" &&
            isSubscribedToInvoice(id)
          ) {
            notifyInvoiceReleased(id, formatAmount(inv.funded));
          }
          prevStatusRef.current = inv.status;
          setInvoice((prev) => mergeWithServer(inv, prev));
        })
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(interval);
  }, [id]);

  const handleNotifyMe = async () => {
    setNotifyDenied(false);
    try {
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        subscribeToInvoice(id);
        setNotifySubscribed(true);
      } else {
        setNotifyDenied(true);
      }
    } catch {
      setNotifyDenied(true);
    }
  };

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
    } finally {
      setPaying(false);
    }
  };

  if (error && !invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400">Loading invoice…</p>
      </main>
    );
  }

  const statusColor: Record<string, string> = {
    Pending: "bg-yellow-500",
    Released: "bg-green-500",
    Refunded: "bg-gray-500",
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold">Invoice #{id}</h1>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${statusColor[invoice.status]}`}
        >
          {invoice.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <PaymentProgress funded={invoice.funded} total={total} />
        <p className="text-sm text-gray-400 mt-1">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
        </p>
      </div>

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
        )}
      </section>

      {/* Recipients */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Recipients</h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between bg-gray-900 rounded-lg px-4 py-2 text-sm"
            >
              <span className="font-mono text-gray-300 truncate max-w-[60%]">
                {r.address}
              </span>
              <span className="text-indigo-300">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Pay form */}
      {invoice.status === "Pending" && publicKey && (
        <form onSubmit={handlePay} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Pay toward this invoice</h2>
          <input
            type="number"
            step="0.0000001"
            min="0.0000001"
            placeholder="Amount in USDC"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
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

      {invoice.status !== "Pending" && (
        <p className="text-gray-400 text-sm">
          This invoice is {invoice.status.toLowerCase()} and no longer accepts payments.
        </p>
      )}
    </main>
  );
}
