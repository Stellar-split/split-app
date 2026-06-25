"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import TxConfirmModal from "@/components/TxConfirmModal";
import EmbedThemeProvider from "@/components/EmbedThemeProvider";
import type { Invoice } from "@stellar-split/sdk";

interface EmbedInvoicePayment {
  payer: string;
  amount: bigint;
  pending?: boolean;
  clientKey?: string;
}

type EmbedInvoice = Omit<Invoice, "payments"> & { payments: EmbedInvoicePayment[] };

interface Props {
  params: { id: string };
}

export default function EmbedInvoicePage({ params }: Props) {
  const { id } = params;
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<EmbedInvoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // Extract theme configuration from query params
  const themeConfig = {
    primaryColor: searchParams.get("primaryColor") || undefined,
    logoUrl: searchParams.get("logoUrl") || undefined,
    borderRadius: searchParams.get("borderRadius") || undefined,
  };

  useEffect(() => {
    const load = async () => {
      try {
        const inv = await splitClient.getInvoice(id);
        setInvoice(inv as EmbedInvoice);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    load();
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
  }, [id]);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const updated = await splitClient.getInvoice(id);
      setInvoice(updated as EmbedInvoice);
      setPayAmount("");
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
      <EmbedThemeProvider config={themeConfig}>
        <div className="w-full max-w-sm mx-auto p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </EmbedThemeProvider>
    );
  }

  if (loading || !invoice) {
    return (
      <EmbedThemeProvider config={themeConfig}>
        <div className="w-full max-w-sm mx-auto p-4 text-center">
          <p className="text-gray-400 text-sm">Loading invoice…</p>
        </div>
      </EmbedThemeProvider>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const statusColor: Record<string, string> = {
    Pending: "bg-yellow-500",
    Released: "bg-green-500",
    Refunded: "bg-gray-500",
  };

  return (
    <EmbedThemeProvider config={themeConfig}>
      <>
        {txHash && (
          <TxConfirmModal
            txHash={txHash}
            action="Payment confirmed"
            onClose={() => setTxHash(null)}
          />
        )}
        <div className="w-full max-w-sm mx-auto p-4 sm:p-6">
          <div
            className="rounded-lg bg-gray-800 border border-gray-700 p-4 sm:p-6"
            style={{ borderRadius: "var(--embed-border-radius)" }}
          >
            {/* Logo section - renders above invoice header when provided */}
            {themeConfig.logoUrl && (
              <div className="mb-4 flex justify-center">
                <Image
                  src={themeConfig.logoUrl}
                  alt="Brand logo"
                  width={48}
                  height={48}
                  className="max-h-12 max-w-full object-contain"
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-bold">Invoice #{id}</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap ${
                  statusColor[invoice.status]
                }`}
                aria-label={`Status: ${invoice.status}`}
              >
                {invoice.status}
              </span>
            </div>

            <div className="space-y-4">
              <PaymentProgress invoice={invoice} />

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 border-t border-gray-700 pt-3">
                <div>
                  <p className="text-gray-500">Recipients</p>
                  <p className="text-white font-medium">{invoice.recipients.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total</p>
                  <p className="text-white font-medium text-right">
                    {formatAmount(total)} USDC
                  </p>
                </div>
              </div>

              {invoice.status === "Pending" && publicKey && (
                <form onSubmit={handlePay} className="pt-2 border-t border-gray-700">
                  <div className="mb-3">
                    <input
                      type="number"
                      placeholder="Amount (USDC)"
                      step="0.0000001"
                      min="0.0000001"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      required
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-xs mb-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={paying || !payAmount}
                    className="w-full min-h-10 px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--embed-primary-color)",
                    }}
                    onMouseEnter={(e) => {
                      const color = getComputedStyle(e.currentTarget).backgroundColor;
                      e.currentTarget.style.filter = "brightness(0.9)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "brightness(1)";
                    }}
                  >
                    {paying ? "Confirming…" : "Pay"}
                  </button>
                </form>
              )}

              {invoice.status !== "Pending" && (
                <div className="pt-2 border-t border-gray-700 text-center">
                  <p className="text-xs text-gray-400">
                    Invoice {invoice.status.toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    </EmbedThemeProvider>
  );
}
