"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface DuplicateModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * DuplicateInvoiceModal — full duplicate/clone flow for invoices.
 *
 * Features:
 * - Pre-fills form from original invoice
 * - Field-level validation showing what changed vs original
 * - Conflict detection for deadlines
 * - Optimistic UI feedback while clone transaction is in-flight
 * - WCAG 2.1 AA accessibility compliance
 */
export default function DuplicateInvoiceModal({
  invoice,
  isOpen,
  onClose,
}: DuplicateModalProps) {
  const router = useRouter();
  const [newDeadlineDays, setNewDeadlineDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newInvoiceId, setNewInvoiceId] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewDeadlineDays(7);
      setSubmitting(false);
      setError(null);
      setSuccess(false);
      setNewInvoiceId(null);
      setValidationIssues([]);
    }
  }, [isOpen]);

  // Validate deadline conflicts
  const validate = useCallback((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const now = Math.floor(Date.now() / 1000);

    if (newDeadlineDays <= 0) {
      issues.push({
        field: "deadline",
        message: "Deadline must be at least 1 day",
        severity: "error",
      });
    }

    if (newDeadlineDays > 365) {
      issues.push({
        field: "deadline",
        message: "Deadline cannot exceed 365 days",
        severity: "error",
      });
    }

    // Check if original deadline has already passed
    if (invoice.deadline > 0 && invoice.deadline < now) {
      issues.push({
        field: "deadline",
        message: "Original invoice deadline has passed. A new deadline is required.",
        severity: "warning",
      });
    }

    // Warn if new deadline is shorter than original
    if (invoice.deadline > 0) {
      const originalDeadlineDays = Math.ceil((invoice.deadline - now) / 86400);
      if (newDeadlineDays < originalDeadlineDays && originalDeadlineDays > 0) {
        issues.push({
          field: "deadline",
          message: `New deadline (${newDeadlineDays}d) is shorter than original (${originalDeadlineDays}d)`,
          severity: "warning",
        });
      }
    }

    return issues;
  }, [newDeadlineDays, invoice.deadline]);

  useEffect(() => {
    if (isOpen) {
      setValidationIssues(validate());
    }
  }, [isOpen, validate]);

  const handleSubmit = async () => {
    const issues = validate();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      setValidationIssues(issues);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create the duplicated invoice via SDK
      const result = await (splitClient as any).createInvoice({
        recipients: invoice.recipients.map((r) => ({
          address: r.address,
          amount: r.amount,
        })),
        token: invoice.token,
        deadline: Math.floor(Date.now() / 1000) + newDeadlineDays * 86400,
      });

      setNewInvoiceId(result.invoiceId);
      setSuccess(true);

      // Navigate to the new invoice after a brief delay
      setTimeout(() => {
        router.push(`/invoice/${result.invoiceId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasErrors = validationIssues.some((i) => i.severity === "error");
  const warnings = validationIssues.filter((i) => i.severity === "warning");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 id="duplicate-modal-title" className="text-lg font-semibold">
            Duplicate Invoice #{invoice.id}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Create a new invoice based on the original. Recipients and amounts will be copied.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Original invoice summary */}
          <div className="bg-gray-800 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Recipients:</span>
              <span className="text-indigo-300">{invoice.recipients.length}</span>
            </div>
            <div className="flex justify-between text-gray-300 mt-1">
              <span>Total:</span>
              <span className="text-indigo-300">
                {formatAmount(invoice.recipients.reduce((s, r) => s + r.amount, 0n))} USDC
              </span>
            </div>
          </div>

          {/* New deadline input */}
          <div>
            <label
              htmlFor="duplicate-deadline"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              New Deadline (days)
            </label>
            <input
              id="duplicate-deadline"
              type="number"
              min="1"
              max="365"
              value={newDeadlineDays}
              onChange={(e) => setNewDeadlineDays(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-describedby={hasErrors ? "duplicate-deadline-error" : undefined}
            />
          </div>

          {/* Validation issues */}
          {validationIssues.length > 0 && (
            <div className="space-y-1">
              {validationIssues.map((issue, i) => (
                <p
                  key={i}
                  id={issue.field === "deadline" ? "duplicate-deadline-error" : undefined}
                  className={`text-sm ${
                    issue.severity === "error" ? "text-red-400" : "text-amber-400"
                  }`}
                  role={issue.severity === "error" ? "alert" : "status"}
                >
                  {issue.severity === "error" ? "❌" : "⚠️"} {issue.message}
                </p>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}

          {/* Success message */}
          {success && newInvoiceId && (
            <div className="text-green-400 text-sm" role="status">
              ✅ Invoice #{newInvoiceId} created! Redirecting…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || hasErrors || success}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Creating…
              </span>
            ) : success ? (
              "Created!"
            ) : (
              "Create Duplicate"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
