"use client";

import { useState, useEffect } from "react";
import { truncateAddress } from "@stellar-split/sdk";
import {
  getPendingRequest,
  submitExtensionRequest,
  approveExtensionRequest,
  denyExtensionRequest,
  type DeadlineExtensionRequest,
} from "@/lib/deadlineExtensionRequests";

interface Props {
  invoiceId: string;
  invoiceCreator: string;
  invoiceDeadline: number; // current deadline, unix timestamp seconds
  currentAddress: string | null;
}

function formatDeadline(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}

function toDatetimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DeadlineExtensionPanel({
  invoiceId,
  invoiceCreator,
  invoiceDeadline,
  currentAddress,
}: Props) {
  const [pending, setPending] = useState<DeadlineExtensionRequest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setPending(getPendingRequest(invoiceId));
  }, [invoiceId]);

  // No wallet connected or not a participant — show nothing
  if (!currentAddress) return null;

  const isCreator = currentAddress === invoiceCreator;

  // ──── Creator view: show pending request banner ────
  if (isCreator) {
    if (!pending) return null;

    const handleApprove = () => {
      try {
        // NOTE: Approval only updates local state. On-chain deadline update is a follow-up.
        approveExtensionRequest(pending.id, currentAddress);
        setSuccessMsg("Extension request approved.");
        setPending(null);
      } catch (err) {
        setSubmitError(String(err));
      }
    };

    const handleDeny = () => {
      try {
        denyExtensionRequest(pending.id, currentAddress);
        setSuccessMsg("Extension request denied.");
        setPending(null);
      } catch (err) {
        setSubmitError(String(err));
      }
    };

    return (
      <section
        aria-labelledby="deadline-ext-heading"
        className="mb-8 border border-amber-600 rounded-lg p-4 bg-amber-900/30"
      >
        <h2 id="deadline-ext-heading" className="text-lg font-semibold text-amber-300 mb-2">
          Deadline Extension Request
        </h2>

        {successMsg ? (
          <p className="text-green-400 text-sm">{successMsg}</p>
        ) : (
          <>
            <div className="text-sm text-gray-300 space-y-1 mb-3">
              <p>
                <span className="text-gray-400">Requester:</span>{" "}
                <span className="text-white font-mono">{truncateAddress(pending.requester)}</span>
              </p>
              <p>
                <span className="text-gray-400">Requested deadline:</span>{" "}
                <span className="text-white">{formatDeadline(pending.requestedDeadline)}</span>
              </p>
              <p>
                <span className="text-gray-400">Reason:</span>{" "}
                <span className="text-white">{pending.reason}</span>
              </p>
            </div>

            {submitError && <p className="text-red-400 text-sm mb-2">{submitError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                className="px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
              >
                Approve
              </button>
              <button
                onClick={handleDeny}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  // ──── Recipient view: request form ────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);

    const deadlineDate = new Date(newDeadline);
    const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);

    if (deadlineUnix <= invoiceDeadline) {
      setSubmitError("New deadline must be after the current deadline.");
      return;
    }

    if (!reason.trim()) {
      setSubmitError("A reason is required.");
      return;
    }

    try {
      submitExtensionRequest(invoiceId, currentAddress, deadlineUnix, reason.trim());
      setPending(getPendingRequest(invoiceId));
      setSuccessMsg("Extension request submitted successfully.");
      setShowForm(false);
      setNewDeadline("");
      setReason("");
    } catch (err) {
      setSubmitError(String(err));
    }
  };

  return (
    <section
      aria-labelledby="deadline-ext-heading"
      className="mb-8 border border-gray-700 rounded-lg p-4 bg-gray-800"
    >
      <h2 id="deadline-ext-heading" className="text-lg font-semibold text-indigo-300 mb-2">
        Deadline Extension
      </h2>

      {successMsg && <p className="text-green-400 text-sm mb-2">{successMsg}</p>}

      {pending ? (
        <p className="text-amber-400 text-sm">
          An extension request is currently pending. Please wait for the creator to respond.
        </p>
      ) : showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="new-deadline" className="block text-sm text-gray-400 mb-1">
              New deadline
            </label>
            <input
              id="new-deadline"
              type="datetime-local"
              value={newDeadline}
              min={toDatetimeLocal(invoiceDeadline)}
              onChange={(e) => setNewDeadline(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="ext-reason" className="block text-sm text-gray-400 mb-1">
              Reason
            </label>
            <textarea
              id="ext-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Why do you need more time?"
            />
          </div>

          {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Submit Request
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setSubmitError(null); }}
              className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Request Extension
        </button>
      )}
    </section>
  );
}
