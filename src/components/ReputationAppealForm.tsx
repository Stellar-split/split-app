'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  submitReputationAppeal,
  getCreatorAppeals,
  type ReputationAppeal,
  type AppealStatus,
} from '../lib/creatorReputation';

export interface ReputationAppealFormProps {
  creatorId: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSubmitted?: (appeal: ReputationAppeal) => void;
}

type FeedbackState =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const STATUS_LABELS: Record<AppealStatus, string> = {
  pending: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_STYLES: Record<AppealStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function formatDate(value: string | number | Date | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ReputationAppealForm({
  creatorId,
  isOpen = true,
  onClose,
  onSubmitted,
}: ReputationAppealFormProps) {
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingAppeals, setLoadingAppeals] = useState(false);
  const [appeals, setAppeals] = useState<ReputationAppeal[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<{ reason?: string; evidenceUrl?: string }>({});

  const loadAppeals = useCallback(async () => {
    if (!creatorId) return;
    setLoadingAppeals(true);
    try {
      const result = await getCreatorAppeals(creatorId);
      setAppeals(Array.isArray(result) ? result : []);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to load your existing appeals.',
      });
    } finally {
      setLoadingAppeals(false);
    }
  }, [creatorId]);

  useEffect(() => {
    if (isOpen) {
      void loadAppeals();
    }
  }, [isOpen, loadAppeals]);

  const validate = useCallback((): boolean => {
    const errors: { reason?: string; evidenceUrl?: string } = {};
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 20) {
      errors.reason = 'Please provide at least 20 characters explaining your appeal.';
    } else if (trimmedReason.length > 2000) {
      errors.reason = 'Reason must be 2000 characters or fewer.';
    }

    const trimmedUrl = evidenceUrl.trim();
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      errors.evidenceUrl = 'Please enter a valid http(s) URL.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [reason, evidenceUrl]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFeedback({ type: 'idle' });

      if (!creatorId) {
        setFeedback({ type: 'error', message: 'Missing creator identity.' });
        return;
      }

      if (!validate()) {
        return;
      }

      setSubmitting(true);
      try {
        const trimmedUrl = evidenceUrl.trim();
        const appeal = await submitReputationAppeal({
          creatorId,
          reason: reason.trim(),
          evidenceUrl: trimmedUrl || undefined,
        });

        setAppeals((prev) => [appeal, ...prev]);
        setReason('');
        setEvidenceUrl('');
        setFieldErrors({});
        setFeedback({
          type: 'success',
          message: 'Your appeal has been submitted. Our team will review it shortly.',
        });
        onSubmitted?.(appeal);
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Something went wrong while submitting your appeal. Please try again.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [creatorId, reason, evidenceUrl, validate, onSubmitted],
  );

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose?.();
  }, [submitting, onClose]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  const reasonCount = reason.trim().length;
  const hasPendingAppeal = useMemo(
    () => appeals.some((a) => a.status === 'pending' || a.status === 'under_review'),
    [appeals],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reputation-appeal-title"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2
              id="reputation-appeal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Dispute your reputation score
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              If you believe your reputation metrics are inaccurate, submit an appeal
              with details and supporting evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="ml-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close appeal form"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4" noValidate>
          {feedback.type !== 'idle' && (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={`mb-4 rounded-md border px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {hasPendingAppeal && (
            <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              You already have an appeal in progress. You may still submit additional
              information below.
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="appeal-reason"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Reason for appeal <span className="text-red-500">*</span>
            </label>
            <textarea
              id="appeal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              maxLength={2000}
              disabled={submitting}
              placeholder="Explain why your reputation score or metrics are inaccurate. Include specific details such as affected projects, dates, or payments."
              className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.reason
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              aria-invalid={Boolean(fieldErrors.reason)}
              aria-describedby={fieldErrors.reason ? 'appeal-reason-error' : undefined}
            />
            <div className="mt-1 flex items-center justify-between">
              {fieldErrors.reason ? (
                <p id="appeal-reason-error" className="text-xs text-red-600">
                  {fieldErrors.reason}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-500">{reasonCount}/2000</span>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="appeal-evidence"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Evidence URL <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="appeal-evidence"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              disabled={submitting}
              placeholder="https://example.com/proof"
              className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.evidenceUrl
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              aria-invalid={Boolean(fieldErrors.evidenceUrl)}
              aria-describedby={
                fieldErrors.evidenceUrl ? 'appeal-evidence-error' : undefined
              }
            />
            {fieldErrors.evidenceUrl && (
              <p id="appeal-evidence-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.evidenceUrl}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit appeal'}
            </button>
          </div>
        </form>

        <div className="border-t border-gray-200 px-6 py-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Your appeals</h3>
          {loadingAppeals ? (
            <p className="text-sm text-gray-500">Loading appeals…</p>
          ) : appeals.length === 0 ? (
            <p className="text-sm text-gray-500">You have not submitted any appeals yet.</p>
          ) : (
            <ul className="space-y-3">
              {appeals.map((appeal) => (
                <li
                  key={appeal.id}
                  className="rounded-md border border-gray-200 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[appeal.status] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {STATUS_LABELS[appeal.status] ?? appeal.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(appeal.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-gray-700">
                    {appeal.reason}
                  </p>
                  {appeal.evidenceUrl && (
                    <a
                      href={appeal.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all text-xs text-blue-600 hover:underline"
                    >
                      {appeal.evidenceUrl}
                    </a>
                  )}
                  {appeal.resolutionNote && (
                    <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      <span className="font-medium">Reviewer note: </span>
                      {appeal.resolutionNote}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}