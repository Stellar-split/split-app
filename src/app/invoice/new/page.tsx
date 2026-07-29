"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Stepper, { type Step } from "@/components/ui/Stepper";
import FormField from "@/components/ui/FormField";
import UnsavedChangesModal from "@/components/ui/UnsavedChangesModal";
import FeeTooltip from "@/components/ui/FeeTooltip";
import { useNetworkFeeBreakdown } from "@/hooks/useNetworkFeeBreakdown";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount, formatAmount } from "@stellar-split/sdk";
import TxConfirmModal from "@/components/TxConfirmModal";
import { recordInvoiceHistory } from "@/lib/invoiceHistory";
import { useI18n } from "@/components/I18nProvider";
import DeadlineSuggester from "@/components/DeadlineSuggester";
import { validateDeadline } from "@/components/DuplicateModal";
import { decodeTemplate } from "@/lib/templateSharing";
import type { ImportedTxData } from "@/lib/txImport";
import {
  generateRetroactiveInvoiceId,
  saveRetroactiveInvoice,
  type RetroactiveInvoice,
} from "@/lib/retroactiveInvoices";
import { useOfflineDraftAutosave } from "@/hooks/useOfflineDraftAutosave";
import {
  getOrCreateLocalUserId,
  listDraftsForUser,
  type StoredDraft,
} from "@/lib/offlineDraftDB";
import SplitCalculator from "@/components/SplitCalculator";
import TagInput from "@/components/invoice/TagInput";
import { useInvoiceTags } from "@/hooks/useInvoiceTags";
import {
  calculateSplit,
  type SplitMeta,
} from "@/hooks/useSplitCalculator";
import InstallmentPlanBuilder from "@/components/invoice/InstallmentPlanBuilder";
import AmountDenominationInput from "@/components/AmountDenominationInput";
import { useXlmUsdcRate } from "@/hooks/useXlmUsdcRate";

import { useInvoiceCollaboration } from "@/hooks/useInvoiceCollaboration";
import CursorOverlay from "@/components/CursorOverlay";
import PresencePill from "@/components/PresencePill";
import ReconnectionBanner from "@/components/ReconnectionBanner";

const RecipientForm = dynamic(() => import("@/components/RecipientForm"), { ssr: false });
const TemplateManager = dynamic(() => import("@/components/TemplateManager"), { ssr: false });
const TxImportPanel = dynamic(() => import("@/components/invoice/TxImportPanel"), { ssr: false });
const DraftRecoveryBanner = dynamic(() => import("@/components/invoice/DraftRecoveryBanner"), { ssr: false });
const CloneBanner = dynamic(() => import("@/components/invoice/CloneBanner"), { ssr: false });

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

/** Clamp an arbitrary `?step=` value onto a real step index. */
function parseStep(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > STEPS.length) return 0;
  return n - 1;
}

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
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-16 text-gray-600 dark:text-gray-400">Loading…</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}

function NewInvoiceForm() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The active step lives in the URL rather than component state so browser
  // back/forward moves through the form instead of leaving the page.
  const step = parseStep(searchParams.get("step"));
  const goToStep = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 0) {
        params.delete("step");
      } else {
        params.set("step", String(next + 1));
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );
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
  const [splitMeta, setSplitMeta] = useState<SplitMeta | null>(null);
  const [installments, setInstallments] = useState<{ id: string; amount: number; dueDate: number; status: string; txHash?: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const { allTags, saveTags } = useInvoiceTags();

  const fromId = searchParams.get("from");
  const deadlineParam = searchParams.get("deadline");
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [originalToken, setOriginalToken] = useState<string | null>(null);
  const [originalRecipients, setOriginalRecipients] = useState<RecipientRow[] | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [cloneDeadlineIso, setCloneDeadlineIso] = useState<string>(deadlineParam ?? "");

  const [formMode, setFormMode] = useState<"create" | "import">("create");
  const [importedTx, setImportedTx] = useState<ImportedTxData | null>(null);
  const [retroSubmitting, setRetroSubmitting] = useState(false);
  const [retroError, setRetroError] = useState<string | null>(null);

  const [draftUserId, setDraftUserId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<StoredDraft | null>(null);

  const isDraftDirty = () => {
    if (!hasUserInteracted) return false;
    return recipients.length > 0 || deadlineDays !== 7 || token !== (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") || tags.length > 0;
  };

  useEffect(() => {
    getFreighterPublicKey()
      .then((pk) => setDraftUserId(pk))
      .catch(() => setDraftUserId(getOrCreateLocalUserId()));
    setDraftId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDraftDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUserInteracted, recipients, deadlineDays, token, tags]);

  useEffect(() => {
    if (!draftUserId || fromId || searchParams.get("template") || searchParams.get("address")) return;
    listDraftsForUser(draftUserId)
      .then((drafts) => {
        if (drafts.length > 0) setRecoveredDraft(drafts[0]);
      })
      .catch(() => null);
    // Only check once per mount, independent of draftId (the newly generated
    // draft won't exist yet so it can never be the one we find here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftUserId]);

  useEffect(() => {
    if (hasUserInteracted) return;
    const initialRecipients = [{ address: "", amount: "" }];
    const initialToken = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";
    const initialDeadline = 7;

    if (JSON.stringify(recipients) !== JSON.stringify(initialRecipients) ||
        token !== initialToken ||
        deadlineDays !== initialDeadline ||
        tags.length > 0) {
      setHasUserInteracted(true);
    }
  }, [recipients, token, deadlineDays, tags, hasUserInteracted]);

  const draftSnapshot = {
    recipients,
    token,
    deadlineDays,
    recurring,
    intervalDays,
    splitMeta,
    installments,
  };

  const { isOffline: draftOffline, discardDraft } = useOfflineDraftAutosave(
    draftUserId ?? "",
    formMode === "create" && !cloneSourceId ? draftId ?? "" : "",
    draftSnapshot
  );

  const handleRestoreDraft = () => {
    if (!recoveredDraft) return;
    setRecipients(recoveredDraft.data.recipients);
    setToken(recoveredDraft.data.token);
    setDeadlineDays(recoveredDraft.data.deadlineDays);
    setRecurring(recoveredDraft.data.recurring);
    setIntervalDays(recoveredDraft.data.intervalDays);
    if ((recoveredDraft.data as any).splitMeta) {
      setSplitMeta((recoveredDraft.data as any).splitMeta);
    }
    if (draftUserId) {
      import("@/lib/offlineDraftDB").then(({ deleteDraft }) =>
        deleteDraft(draftUserId, recoveredDraft.draftId)
      );
    }
    setRecoveredDraft(null);
    addToast("Draft restored", "success");
  };

  const handleDiscardDraft = () => {
    if (recoveredDraft && draftUserId) {
      import("@/lib/offlineDraftDB").then(({ deleteDraft }) =>
        deleteDraft(draftUserId, recoveredDraft.draftId)
      );
    }
    setRecoveredDraft(null);
  };

  const { toasts, addToast } = useToasts();

  const handleSplitEqually = () => {
    if (recipients.length <= 1) return;

    setPreviousRecipientsForUndo([...recipients]);

    const { perRecipient, remainder } = (() => {
      const pp = Math.floor(100 / recipients.length);
      const rem = 100 - (pp * recipients.length);
      return { perRecipient: pp, remainder: rem };
    })();

    const newRecipients = recipients.map((r, index) => ({
      ...r,
      amount: (100 / recipients.length).toFixed(7),
    }));

    if (remainder > 0 && newRecipients.length > 0) {
      const firstAmount = parseFloat(newRecipients[0].amount) + (remainder / recipients.length);
      newRecipients[0].amount = firstAmount.toFixed(7);
    }

    setRecipients(newRecipients);
    addToast("Split distributed equally", "success");
  };

  const handleUndoSplit = () => {
    if (previousRecipientsForUndo) {
      setRecipients(previousRecipientsForUndo);
      setPreviousRecipientsForUndo(null);
      addToast("Distribution undone", "success");
    }
  };

  const markFieldTouched = (fieldName: string) => {
    setTouchedFields((prev) => new Set([...prev, fieldName]));
  };

  const validateField = (fieldName: string, value: unknown): string | null => {
    if (fieldName === 'token') {
      const tokenValue = value as string;
      if (!tokenValue || !tokenValue.startsWith('C')) {
        return 'Valid token contract address (starting with C) is required';
      }
    } else if (fieldName === 'deadlineDays') {
      const days = value as number;
      if (days < 1 || days > 365) {
        return 'Deadline must be between 1 and 365 days';
      }
    } else if (fieldName === 'cloneDeadline') {
      const deadlineError = validateDeadline(value as string);
      return deadlineError;
    }
    return null;
  };

  const handleFieldBlur = (fieldName: string, value: unknown) => {
    markFieldTouched(fieldName);
    setHasUserInteracted(true);
    const error = validateField(fieldName, value);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setHasUserInteracted(true);
    if (touchedFields.has(fieldName)) {
      const error = validateField(fieldName, value);
      setFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
    }
  };

  const handleImported = (data: ImportedTxData) => {
    setImportedTx(data);
    setRetroError(null);
  };

  const handleRetroactiveSubmit = async () => {
    if (!importedTx) return;
    setRetroSubmitting(true);
    setRetroError(null);
    try {
      const creator = await getFreighterPublicKey().catch(() => importedTx.recipients[0]?.address ?? "unknown");
      const recipients = importedTx.recipients.map((r) => ({
        address: r.address,
        amount: parseAmount(r.amount),
      }));
      const total = recipients.reduce((s, r) => s + r.amount, 0n);
      const id = generateRetroactiveInvoiceId(importedTx.txHash);
      const record: RetroactiveInvoice = {
        id,
        creator,
        recipients,
        token: importedTx.recipients[0]?.asset ?? "XLM",
        deadline: 0,
        funded: total,
        status: "Released",
        payments: [{ payer: creator, amount: total }],
        retroactive: true,
        sourceTxHash: importedTx.txHash,
        memo: importedTx.memo,
        createdAt: importedTx.createdAt,
      };
      saveRetroactiveInvoice(record);
      addToast(`Retroactive invoice #${id} created`, "success");
      router.push(`/invoice/${id}`);
    } catch (err) {
      setRetroError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetroSubmitting(false);
    }
  };

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

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ txHash: string; invoiceId: string } | null>(null);
  const [equalSplit, setEqualSplit] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({});
  const [previousRecipientsForUndo, setPreviousRecipientsForUndo] = useState<RecipientRow[] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const { feeBreakdown, isLoading: feeLoading, error: feeError, refetch: refetchFees } = useNetworkFeeBreakdown();

  // Denomination toggle state (XLM / USDC)
  type Denomination = "XLM" | "USDC";
  const [amountDenom, setAmountDenom] = useState<Denomination>("USDC");
  const xlmUsdcRate = useXlmUsdcRate();

  /** Convert an amount string from current denomination to USDC for on-chain use */
  const toUsdc = useCallback(
    (amount: string): string => {
      if (amountDenom === "USDC" || !xlmUsdcRate) return amount;
      const n = parseFloat(amount);
      if (isNaN(n)) return amount;
      return (n * xlmUsdcRate).toFixed(7).replace(/\.?0+$/, "");
    },
    [amountDenom, xlmUsdcRate],
  );

  useEffect(() => {
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
  }, []);

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
        if (splitMeta && splitMeta.recipients.length > 0) {
          const splitResult = calculateSplit(splitMeta.totalAmount, splitMeta.recipients, splitMeta.assetCode);
          if (!splitResult.validation.isValid) {
            setStepErrors((prev) => ({
              ...prev,
              [s]: splitResult.validation.errorMessage ?? "Split calculator has invalid configuration",
            }));
            return false;
          }
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

  /**
   * Reason the split is not submittable, or null when it is. Drives both the
   * disabled state and the tooltip on the create button so the user can see
   * *why* it is blocked without first clicking it.
   */
  const splitBlockReason = useMemo(() => {
    if (!splitMeta || splitMeta.recipients.length === 0) return null;
    const { validation } = calculateSplit(
      splitMeta.totalAmount,
      splitMeta.recipients,
      splitMeta.assetCode
    );
    return validation.isValid ? null : validation.errorMessage ?? "Split configuration is invalid";
  }, [splitMeta]);

  const handleNext = () => {
    if (validateStep(step)) {
      goToStep(Math.min(step + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    if (step > 0) {
      goToStep(Math.max(step - 1, 0));
    }
  };

  const handleProtectedNavigation = (href: string) => {
    if (isDraftDirty()) {
      setPendingNavigationHref(href);
      setShowUnsavedModal(true);
    } else {
      router.push(href);
    }
  };

  const payloadForApi = () => {
    if (!splitMeta) return null;
    if (installments.length === 0) return splitMeta;
    return { ...splitMeta, installments };
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
            amount: parseAmount(toUsdc(r.amount)),
          })),
          token,
          deadline: deadlineTs,
        });

        recordInvoiceHistory(
          recipients.map((r) => ({ address: r.address, amount: r.amount }))
        );
        addToast(`Invoice #${invoiceId} created`, "success");
        const apiPayload = payloadForApi();
        if (apiPayload && (apiPayload as any).recipients?.length > 0) {
          fetch(`/api/invoices/${invoiceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ splitMeta: apiPayload }),
          }).catch(() => null);
        }
        if (tags.length > 0) {
          saveTags(invoiceId, tags).catch(() => null);
        }
        setTxModal({ txHash, invoiceId });
      } else {
        const { invoiceId, txHash } = await splitClient.createInvoice({
          creator,
          recipients: recipients.map((r) => ({
            address: r.address,
            amount: parseAmount(equalSplit ? toUsdc(perRecipientAmount ?? "0") : toUsdc(r.amount)),
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
        const apiPayload = payloadForApi();
        if (apiPayload && (apiPayload as any).recipients?.length > 0) {
          fetch(`/api/invoices/${invoiceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ splitMeta: apiPayload }),
          }).catch(() => null);
        }
        if (tags.length > 0) {
          saveTags(invoiceId, tags).catch(() => null);
        }
        setTxModal({ txHash, invoiceId });
      }
      discardDraft();
    } catch (err) {
      const msg = String(err);
      setError(msg);
      if (cloneSourceId) addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const stepperSteps: Step[] = useMemo(
    () =>
      STEPS.map((label, index) => ({
        label,
        status: index < step ? "complete" : index === step ? "current" : "upcoming",
      })),
    [step]
  );

  const renderStepIndicator = () => (
    <Stepper steps={stepperSteps} onStepClick={goToStep} className="mb-8" />
  );

  const renderBasicInfo = () => (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Basic Info</h2>

      {!cloneSourceId && (
        <TemplateManager
          recipients={recipients}
          token={token}
          onLoad={handleLoadTemplate}
        />
      )}

      <ChangedField changed={tokenChanged}>
        <FormField
          id="token-address"
          label={t("invoiceNew.tokenAddress")}
          error={touchedFields.has('token') ? fieldErrors['token'] : null}
          required
        >
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onFocus={() => setFocusedField("token-address")}
            onBlur={() => {
              if (focusedField === "token-address") emitFieldBlur();
            }}
            required
            placeholder="C..."
            className={`w-full min-h-11 bg-gray-800 border rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              touchedFields.has('token') && fieldErrors['token']
                ? 'border-red-500'
                : 'border-gray-700'
            }`}
          />
          <CursorOverlay cursors={remoteCursors} fieldName="token-address" />
        </ChangedField>
      </div>

      {cloneSourceId ? (
        <FormField
          id="clone-deadline"
          label={t("invoiceNew.deadline")}
          error={touchedFields.has('cloneDeadline') ? fieldErrors['cloneDeadline'] : null}
          required
        >
          <input
            type="datetime-local"
            value={cloneDeadlineIso.slice(0, 16)}
            onChange={(e) => {
              setCloneDeadlineIso(e.target.value);
              handleFieldChange('cloneDeadline', e.target.value);
            }}
            onBlur={(e) => handleFieldBlur('cloneDeadline', e.target.value)}
            className={`w-full min-h-11 bg-gray-800 border rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              touchedFields.has('cloneDeadline') && fieldErrors['cloneDeadline']
                ? 'border-red-500'
                : 'border-gray-700'
            }`}
          />
        </FormField>
      ) : (
        <FormField
          id="deadline-days"
          label={t("invoiceNew.deadline")}
          error={touchedFields.has('deadlineDays') ? fieldErrors['deadlineDays'] : null}
          required
        >
          <input
            type="number"
            min={1}
            max={365}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            onFocus={() => setFocusedField("deadline-days")}
            onBlur={() => {
              if (focusedField === "deadline-days") emitFieldBlur();
            }}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <CursorOverlay cursors={remoteCursors} fieldName="deadline-days" />
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
        </FormField>
      )}

      {!cloneSourceId && (
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
          <label htmlFor="interval-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Repeat every
          </label>
          <select
            id="interval-days"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value) as 7 | 30)}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recipients</h2>

      {!cloneSourceId && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
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

          {!equalSplit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSplitEqually}
                disabled={recipients.length <= 1}
                aria-label="Distribute all amounts equally among recipients"
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Split equally
              </button>
              {previousRecipientsForUndo && (
                <button
                  type="button"
                  onClick={handleUndoSplit}
                  aria-label="Undo the equal split distribution"
                  className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  ↶ Undo
                </button>
              )}
            </div>
          )}
        </>
      )}

      {equalSplit && !cloneSourceId && (
        <>
          <FormField
            id="total-amount"
            type="number"
            placeholder="0.00"
            step="0.0000001"
            min="0.0000001"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            onFocus={() => setFocusedField("total-amount")}
            onBlur={() => {
              if (focusedField === "total-amount") emitFieldBlur();
            }}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <CursorOverlay cursors={remoteCursors} fieldName="total-amount" />
          {perRecipientAmount && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {perRecipientAmount} {t("invoiceNew.perRecipient")}
            </p>
          )}
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {equalSplit ? t("invoiceNew.recipients") : t("invoiceNew.recipientsAndAmounts")}
          </label>
          {!equalSplit && !cloneSourceId && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Amounts in:</span>
              <button
                type="button"
                onClick={() => setAmountDenom((d) => d === "XLM" ? "USDC" : "XLM")}
                aria-label={`Switch amount denomination to ${amountDenom === "XLM" ? "USDC" : "XLM"}`}
                title={xlmUsdcRate ? `1 XLM ≈ ${xlmUsdcRate.toFixed(4)} USDC` : "Rate unavailable"}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                  amountDenom === "XLM"
                    ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25"
                    : "bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25"
                }`}
              >
                <span aria-hidden="true">{amountDenom === "XLM" ? "✦" : "$"}</span>
                {amountDenom}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
              {xlmUsdcRate && (
                <span className="text-xs text-gray-500">1 XLM ≈ {xlmUsdcRate.toFixed(4)} USDC</span>
              )}
            </div>
          )}
        </div>
        <ChangedField changed={recipientsChanged}>
          <RecipientForm
            recipients={recipients}
            onChange={setRecipients}
            equalSplit={equalSplit}
            amountOverride={perRecipientAmount}
          />
        </ChangedField>
      </div>

      <SplitCalculator
        initialTotal={equalSplit ? totalAmount : recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0).toFixed(7)}
        onSplitMetaChange={setSplitMeta}
      />
    </div>
  );

  const renderOptions = () => {
    const total = recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
    return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Options</h2>

      <TagInput
        value={tags}
        onChange={setTags}
        suggestions={allTags}
        placeholder="e.g. design, q3-retainer"
      />

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
          Autofilled from history — you can override any value below.
        </p>
      )}

      {recurring && !cloneSourceId && (
        <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
          <p className="text-sm text-gray-300">
            This invoice will repeat every <span className="font-semibold text-indigo-300">{intervalDays} days</span>
          </p>
        </div>
      )}

      <InstallmentPlanBuilder
        totalAmount={total}
        installments={installments}
        assetCode={token === (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") ? "USDC" : "XLM"}
        onChange={setInstallments}
      />
    </div>
    );
  };

  const renderReview = () => {
    const total = recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Review & Submit</h2>

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
            <FeeTooltip
              feeBreakdown={feeBreakdown}
              isLoading={feeLoading}
              error={feeError}
              onRefresh={refetchFees}
            >
              <span className="text-sm text-gray-200 font-semibold cursor-help hover:text-indigo-300 transition-colors">
                {equalSplit ? totalAmount : total.toFixed(7)} USDC
              </span>
            </FeeTooltip>
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
      {/* Collaboration presence */}
      {publicKey && <PresencePill presences={remotePresence} currentAddress={publicKey} />}

      <ReconnectionBanner
        show={!collabConnected && !!publicKey}
        isConnected={collabConnected}
      />

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

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <button
          type="button"
          onClick={() => handleProtectedNavigation('/')}
          className="text-2xl hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          aria-label="Back to home"
        >
          ←
        </button>
        <h1 className="text-3xl font-bold">Create Invoice</h1>
        {draftOffline && (
          <span
            role="status"
            className="inline-flex items-center gap-1 rounded-full font-semibold text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400"
          >
            ⚠ Offline — drafts save locally
          </span>
        )}
      </div>

      {recoveredDraft && (
        <DraftRecoveryBanner
          updatedAt={recoveredDraft.updatedAt}
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      {cloneSourceId && (
        <CloneBanner sourceId={cloneSourceId} />
      )}

      {!cloneSourceId && (
        <div className="flex gap-1 border-b border-gray-700 mb-8" role="tablist" aria-label="Invoice creation mode">
          <button
            type="button"
            role="tab"
            aria-selected={formMode === "create"}
            onClick={() => setFormMode("create")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg -mb-px border-b-2 ${
              formMode === "create"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Create New
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={formMode === "import"}
            onClick={() => setFormMode("import")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg -mb-px border-b-2 ${
              formMode === "import"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Import from Transaction
          </button>
        </div>
      )}

      {formMode === "import" && !cloneSourceId ? (
        <div className="flex flex-col gap-6">
          <TxImportPanel onImported={handleImported} />

          {importedTx && (
            <div className="flex flex-col gap-4 rounded-lg bg-indigo-950/40 border border-indigo-800 px-4 py-4">
              <p className="text-sm text-indigo-200">
                This invoice will be created as <strong>retroactive</strong> and marked{" "}
                <strong>Fully Paid</strong> automatically — no on-chain payment is required.
              </p>
              {retroError && (
                <p role="alert" className="text-red-400 text-sm">{retroError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRetroactiveSubmit}
                  disabled={retroSubmitting}
                  className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {retroSubmitting ? "Creating…" : "Create Retroactive Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => setImportedTx(null)}
                  className="min-h-11 px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-medium transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
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
          <p className="text-gray-600 dark:text-gray-400" aria-live="polite">Loading invoice data…</p>
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

        {error && <p role="alert" className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

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
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !!deadlineError || !!splitBlockReason}
                title={splitBlockReason ?? undefined}
                aria-describedby={splitBlockReason ? "split-block-reason" : undefined}
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            {step === STEPS.length - 1 && splitBlockReason && (
              <p
                id="split-block-reason"
                role="status"
                className="mt-2 max-w-xs text-right text-xs text-red-400"
              >
                {splitBlockReason}
              </p>
            )}
          </div>
        </div>
      </form>
      </>
      )}

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={() => {
          setShowUnsavedModal(false);
          discardDraft();
          if (pendingNavigationHref) {
            router.push(pendingNavigationHref);
          }
        }}
        onKeepEditing={() => {
          setShowUnsavedModal(false);
          setPendingNavigationHref(null);
        }}
      />
    </main>
  );
}
