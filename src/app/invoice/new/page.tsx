"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount, formatAmount } from "@stellar-split/sdk";
import TxConfirmModal from "@/components/TxConfirmModal";
import { recordInvoiceHistory } from "@/lib/invoiceHistory";
import { useI18n } from "@/components/I18nProvider";
import DeadlineSuggester from "@/components/DeadlineSuggester";
import { validateDeadline } from "@/components/DuplicateModal";
import { decodeTemplate } from "@/lib/templateSharing";

const RecipientForm = dynamic(() => import("@/components/RecipientForm"), { ssr: false });
const TemplateManager = dynamic(() => import("@/components/TemplateManager"), { ssr: false });

interface RecipientRow {
  address: string;
  amount: string;
}

interface InvoiceTemplate {
  recipients: RecipientRow[];
  deadlineDays: number;
  token: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let _toastId = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  return { toasts, addToast };
}

const STEPS = ["Basic Info", "Recipients", "Options", "Review & Submit"];

function ChangedField({ changed, children }: { changed: boolean; children: React.ReactNode }) {
  if (!changed) return <>{children}</>;
  return (
    <div className="relative group">
      <div className="ring-2 ring-yellow-400 rounded-lg">{children}</div>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-0 z-10 hidden group-hover:block bg-yellow-900 text-yellow-200 text-xs px-2 py-1 rounded whitespace-nowrap"
      >
        Changed from original
      </span>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-16 text-gray-400">Loading…</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}

function NewInvoiceForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { address: "", amount: "" },
  ]);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [token, setToken] = useState(
    process.env.NEXT_PUBLIC_USDC_ADDRESS ?? ""
  );
  const [recurring, setRecurring] = useState(false);
  const [intervalDays, setIntervalDays] = useState<7 | 30>(7);
  const [submitting, setSubmitting] = useState(false);

  const fromId = searchParams.get("from");
  const deadlineParam = searchParams.get("deadline");
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [originalToken, setOriginalToken] = useState<string | null>(null);
  const [originalRecipients, setOriginalRecipients] = useState<RecipientRow[] | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [cloneDeadlineIso, setCloneDeadlineIso] = useState<string>(deadlineParam ?? "");

  const { toasts, addToast } = useToasts();

  useEffect(() => {
    const address = searchParams.get("address");
    const templateParam = searchParams.get("template");

    if (address) {
      setRecipients([{ address, amount: "" }]);
      return;
    }

    if (templateParam) {
      const decoded = decodeTemplate(templateParam);
      if (decoded) {
        setRecipients(decoded.recipients);
        setToken(decoded.token);
        addToast("Shared template loaded successfully", "success");
      } else {
        addToast("Failed to decode shared template: invalid format", "error");
      }
      return;
    }

    const template = sessionStorage.getItem("invoiceTemplate");
    if (template) {
      const parsed: InvoiceTemplate = JSON.parse(template);
      setRecipients(parsed.recipients);
      setDeadlineDays(parsed.deadlineDays);
      setToken(parsed.token);
      sessionStorage.removeItem("invoiceTemplate");
    }
  }, [searchParams, addToast]);

  const [error, setError] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ txHash: string; invoiceId: string } | null>(null);
  const [equalSplit, setEqualSplit] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (fromId || sessionStorage.getItem("invoiceTemplate")) return;
  // Autofill from invoice history on first load (skip if duplicating or using a template or pre-filled address)
  useEffect(() => {
    if (fromId || sessionStorage.getItem("invoiceTemplate") || searchParams.get("address")) return;

    getFreighterPublicKey()
      // as any: getInvoicesByCreator is not yet declared in the published @stellar-split/sdk types
      .then((pk) => (splitClient as any).getInvoicesByCreator(pk))
      .then((invoices: import("@stellar-split/sdk").Invoice[]) => {
        if (!invoices || invoices.length === 0) return;
        const recent = invoices.slice(-5);
        const latestToken = recent[recent.length - 1].token;
        const now = Math.floor(Date.now() / 1000);
        const daysList = recent
          .map((inv) => Math.round((inv.deadline - now) / 86400))
          .filter((d) => d > 0)
          .sort((a, b) => a - b);
        const medianDays =
          daysList.length > 0
            ? daysList[Math.floor(daysList.length / 2)]
            : null;
        const lastRecipients = recent[recent.length - 1].recipients.map((r) => ({
          address: r.address,
          amount: formatAmount(r.amount),
        }));
        setToken(latestToken);
        if (medianDays !== null) setDeadlineDays(medianDays);
        setRecipients(lastRecipients.length > 0 ? lastRecipients : [{ address: "", amount: "" }]);
        setAutofilled(true);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!fromId) return;
    setLoading(true);
    splitClient
      .getInvoice(fromId)
      .then((invoice) => {
        const recipientRows = invoice.recipients.map((r) => ({
          address: r.address,
          amount: formatAmount(r.amount),
        }));
        setRecipients(recipientRows);
        setOriginalRecipients(recipientRows);
        setToken(invoice.token);
        setOriginalToken(invoice.token);
        setCloneSourceId(fromId);
        if (deadlineParam) {
          const err = validateDeadline(deadlineParam);
          if (err) setDeadlineError(err);
          setCloneDeadlineIso(deadlineParam);
        }
      })
      .catch((err) => {
        setError(`Failed to load source invoice: ${err}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fromId]);

  const perRecipientAmount =
    equalSplit && totalAmount && recipients.length > 0
      ? (parseFloat(totalAmount) / recipients.length).toFixed(7)
      : undefined;

  const handleLoadTemplate = (template: { recipients: RecipientRow[]; token: string }) => {
    setRecipients(template.recipients);
    setToken(template.token);
  };

  const recipientsChanged =
    !!originalRecipients &&
    JSON.stringify(recipients) !== JSON.stringify(originalRecipients);

  const tokenChanged = !!originalToken && token !== originalToken;

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 0: {
        if (!token || !token.startsWith("C")) {
          setStepErrors((prev) => ({ ...prev, [s]: "Valid token contract address is required" }));
          return false;
        }
        if (cloneSourceId && cloneDeadlineIso) {
          const err = validateDeadline(cloneDeadlineIso);
          if (err) {
            setDeadlineError(err);
            setStepErrors((prev) => ({ ...prev, [s]: err }));
            return false;
          }
        }
        setStepErrors((prev) => ({ ...prev, [s]: null }));
        return true;
      }
      case 1: {
        if (recipients.length === 0 || !recipients[0].address) {
          setStepErrors((prev) => ({ ...prev, [s]: "At least one recipient is required" }));
          return false;
        }
        const validRecipients = recipients.every(
          (r) => r.address.startsWith("G") && r.address.length >= 50 && parseFloat(r.amount || "0") > 0
        );
        if (!validRecipients) {
          setStepErrors((prev) => ({ ...prev, [s]: "Each recipient needs a valid G... address and positive amount" }));
          return false;
        }
        setStepErrors((prev) => ({ ...prev, [s]: null }));
        return true;
      }
      case 2:
        setStepErrors((prev) => ({ ...prev, [s]: null }));
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;
    setError(null);

    if (cloneSourceId && cloneDeadlineIso) {
      const err = validateDeadline(cloneDeadlineIso);
      if (err) {
        setDeadlineError(err);
        return;
      }
    }

    setSubmitting(true);

    try {
      const creator = await getFreighterPublicKey();

      if (cloneSourceId) {
        const deadlineTs = Math.floor(new Date(cloneDeadlineIso).getTime() / 1000);

        // as any: cloneInvoice is not yet declared in the published @stellar-split/sdk types
        const { invoiceId, txHash } = await (splitClient as any).cloneInvoice({
          creator,
          sourceInvoiceId: cloneSourceId,
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: parseAmount(r.amount),
          })),
          token,
          deadline: deadlineTs,
        });

        recordInvoiceHistory(
          recipients.map((r) => ({ address: r.address, amount: r.amount }))
        );
        addToast(`Invoice #${invoiceId} created`, "success");
        setTxModal({ txHash, invoiceId });
      } else {
        const { invoiceId, txHash } = await splitClient.createInvoice({
          creator,
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: parseAmount(equalSplit ? (perRecipientAmount ?? "0") : r.amount),
          })),
          token,
          deadline: deadlineFromDays(deadlineDays),
          ...(recurring && { recurring, intervalDays }),
        });

        recordInvoiceHistory(
          recipients.map((r) => ({
            address: r.address,
            amount: equalSplit ? (perRecipientAmount ?? "0") : r.amount,
          }))
        );
        setTxModal({ txHash, invoiceId });
      }
    } catch (err) {
      const msg = String(err);
      setError(msg);
      if (cloneSourceId) addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-8" aria-label="Form steps">
      {STEPS.map((label, i) => {
        const isActive = i === step;
        const isPast = i < step;
        return (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={() => { if (i < step || validateStep(step)) setStep(i); }}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : isPast
                  ? "bg-indigo-900/50 text-indigo-300"
                  : "bg-gray-800 text-gray-500"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black/20 text-[10px] font-bold">
                {isPast ? "\u2713" : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${isPast ? "bg-indigo-600" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBasicInfo = () => (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">Basic Info</h2>

      {!cloneSourceId && (
        <TemplateManager
          recipients={recipients}
          token={token}
          onLoad={handleLoadTemplate}
        />
      )}

      <div>
        <label htmlFor="token-address" className="block text-sm font-medium text-gray-300 mb-1">
          {t("invoiceNew.tokenAddress")}
        </label>
        <ChangedField changed={tokenChanged}>
          <input
            id="token-address"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="C..."
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </ChangedField>
      </div>

      {cloneSourceId ? (
        <div>
          <label htmlFor="clone-deadline" className="block text-sm font-medium text-gray-300 mb-1">
            {t("invoiceNew.deadline")}
          </label>
          <input
            id="clone-deadline"
            type="datetime-local"
            value={cloneDeadlineIso.slice(0, 16)}
            onChange={(e) => {
              setCloneDeadlineIso(e.target.value);
              const err = validateDeadline(e.target.value);
              setDeadlineError(err);
              setStepErrors((prev) => ({ ...prev, [0]: err }));
            }}
            required
            className={`w-full min-h-11 bg-gray-800 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              deadlineError ? "border-red-500" : "border-gray-700"
            }`}
            aria-describedby={deadlineError ? "clone-deadline-error" : undefined}
            aria-invalid={!!deadlineError}
          />
          {deadlineError && (
            <p id="clone-deadline-error" role="alert" className="text-red-400 text-sm mt-1">
              {deadlineError}
            </p>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="deadline-days" className="block text-sm font-medium text-gray-300 mb-1">
            {t("invoiceNew.deadline")}
          </label>
          <input
            id="deadline-days"
            type="number"
            min={1}
            max={365}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <DeadlineSuggester
            totalAmount={
              equalSplit
                ? totalAmount
                : recipients
                    .reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0)
                    .toString()
            }
            recipientCount={recipients.filter((r) => r.address).length}
            onUseSuggestion={(days: number) => setDeadlineDays(days)}
          />
        </div>
      )}

      {!cloneSourceId && (
        <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
          <label htmlFor="recurring-toggle" className="text-sm font-medium text-gray-300 cursor-pointer">
            Recurring invoice
          </label>
          <button
            id="recurring-toggle"
            type="button"
            role="switch"
            aria-checked={recurring}
            onClick={() => setRecurring((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              recurring ? "bg-indigo-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                recurring ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      {recurring && !cloneSourceId && (
        <div>
          <label htmlFor="interval-days" className="block text-sm font-medium text-gray-300 mb-1">
            Repeat every
          </label>
          <select
            id="interval-days"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value) as 7 | 30)}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      )}
    </div>
  );

  const renderRecipients = () => (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">Recipients</h2>

      {!cloneSourceId && (
        <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
          <label htmlFor="equal-split-toggle" className="text-sm font-medium text-gray-300 cursor-pointer">
            {t("invoiceNew.equalSplit")}
          </label>
          <button
            id="equal-split-toggle"
            type="button"
            role="switch"
            aria-checked={equalSplit}
            aria-label="Toggle equal split mode"
            onClick={() => setEqualSplit((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              equalSplit ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                equalSplit ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      {equalSplit && !cloneSourceId && (
        <div>
          <label htmlFor="total-amount" className="block text-sm font-medium text-gray-300 mb-1">
            {t("invoiceNew.totalAmount")}
          </label>
          <input
            id="total-amount"
            type="number"
            placeholder="0.00"
            step="0.0000001"
            min="0.0000001"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {perRecipientAmount && (
            <p className="mt-1 text-xs text-gray-400">
              {perRecipientAmount} {t("invoiceNew.perRecipient")}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {equalSplit ? t("invoiceNew.recipients") : t("invoiceNew.recipientsAndAmounts")}
        </label>
        <ChangedField changed={recipientsChanged}>
          <RecipientForm
            recipients={recipients}
            onChange={setRecipients}
            equalSplit={equalSplit}
            amountOverride={perRecipientAmount}
          />
        </ChangedField>
      </div>
    </div>
  );

  const renderOptions = () => (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">Options</h2>

      {cloneSourceId && (
        <div className="flex items-center gap-2 text-sm bg-indigo-950/60 border border-indigo-700 text-indigo-300 rounded-lg px-3 py-2">
          <span>Cloned from</span>
          <a
            href={`/invoice/${cloneSourceId}`}
            className="underline hover:text-indigo-200 font-mono"
          >
            #{cloneSourceId}
          </a>
        </div>
      )}

      {!cloneSourceId && (
        <TemplateManager
          recipients={recipients}
          token={token}
          onLoad={handleLoadTemplate}
        />
      )}

      {autofilled && !cloneSourceId && (
        <p className="text-xs text-indigo-400 bg-indigo-950/50 border border-indigo-800 rounded-lg px-3 py-2">
          Autofilled from history — you can override any value.
        </p>
      )}

      {recurring && !cloneSourceId && (
        <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
          <p className="text-sm text-gray-300">
            This invoice will repeat every <span className="font-semibold text-indigo-300">{intervalDays} days</span>
          </p>
        </div>
      )}
    </div>
  );

  const renderReview = () => {
    const total = recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-white">Review & Submit</h2>

        {cloneSourceId && (
          <div className="flex items-center gap-2 text-sm bg-indigo-950/60 border border-indigo-700 text-indigo-300 rounded-lg px-3 py-2">
            <span>Cloned from</span>
            <a href={`/invoice/${cloneSourceId}`} className="underline hover:text-indigo-200 font-mono">
              #{cloneSourceId}
            </a>
          </div>
        )}

        <div className="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700">
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-400">Token</span>
            <span className="text-sm text-gray-200 font-mono truncate ml-2">{token}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-400">Deadline</span>
            <span className="text-sm text-gray-200">
              {cloneSourceId
                ? new Date(cloneDeadlineIso).toLocaleString()
                : `${deadlineDays} days`}
            </span>
          </div>
          {recurring && !cloneSourceId && (
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-400">Recurring</span>
              <span className="text-sm text-gray-200">Every {intervalDays} days</span>
            </div>
          )}
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-400">Recipients</span>
            <span className="text-sm text-gray-200">{recipients.length}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-sm text-gray-200 font-semibold">
              {equalSplit ? totalAmount : total.toFixed(7)} USDC
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-gray-800 border border-gray-700">
          <div className="px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-700">
            Recipients
          </div>
          <ul className="divide-y divide-gray-700">
            {recipients.map((r, i) => (
              <li key={i} className="px-4 py-2 flex justify-between items-center gap-2">
                <span className="text-sm font-mono text-gray-300 truncate">{r.address}</span>
                <span className="text-sm text-indigo-300 shrink-0">
                  {equalSplit ? perRecipientAmount : r.amount} USDC
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg pointer-events-auto ${
              t.type === "success"
                ? "bg-green-800 text-green-100"
                : "bg-red-800 text-red-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {txModal && (
        <TxConfirmModal
          txHash={txModal.txHash}
          action="Invoice created"
          onClose={() => router.push(`/invoice/${txModal.invoiceId}`)}
        />
      )}

      <h1 className="text-3xl font-bold mb-2">Create Invoice</h1>
      <h1 className="text-3xl font-bold mb-8">Create Invoice</h1>

      {/* Cloned-from banner */}
      {cloneSourceId && (
        <div className="mb-6 flex items-center gap-2 text-sm bg-indigo-950/60 border border-indigo-700 text-indigo-300 rounded-lg px-3 py-2">
          <span>🔁 Cloned from</span>
          <a
            href={`/invoice/${cloneSourceId}`}
            className="underline hover:text-indigo-200 font-mono"
          >
            #{cloneSourceId}
          </a>
        </div>
      )}

      {autofilled && !cloneSourceId && !searchParams.get("address") && (
        <p className="mb-6 text-xs text-indigo-400 bg-indigo-950/50 border border-indigo-800 rounded-lg px-3 py-2">
          ✦ Autofilled from history — you can override any value below.
        </p>
      )}

      {searchParams.get("address") && !cloneSourceId && (
        <p className="mb-6 text-xs text-indigo-400 bg-indigo-950/50 border border-indigo-800 rounded-lg px-3 py-2">
          ✦ Address pre-filled from address book — you can override any value below.
        </p>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400" aria-live="polite">Loading invoice data…</p>
        </div>
      )}

      {!loading && renderStepIndicator()}

      {stepErrors[step] && (
        <p role="alert" className="text-red-400 text-sm mb-4 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          {stepErrors[step]}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-label="Create invoice form">
        {step === 0 && !loading && renderBasicInfo()}
        {step === 1 && !loading && renderRecipients()}
        {step === 2 && !loading && renderOptions()}
        {step === 3 && !loading && renderReview()}

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="min-h-11 px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-medium transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !!deadlineError}
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
              >
                {submitting
                  ? cloneSourceId
                    ? "Cloning…"
                    : t("invoiceNew.creating")
                  : cloneSourceId
                  ? "Clone Invoice"
                  : t("invoiceNew.create")}
              </button>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
