"use client";

import { useState } from "react";
import {
  type MultiSigApprovalRecord,
  getApprovalProgress,
} from "@/services/multiSigApproval";

interface Props {
  record: MultiSigApprovalRecord;
  connectedAddress?: string;
  onApprove?: (signer: string, signature: string) => void;
}

export default function MultiSigApprovalPanel({
  record,
  connectedAddress,
  onApprove,
}: Props) {
  const [signing, setSigning] = useState(false);
  const progress = getApprovalProgress(record);
  const { approved, required, isComplete } = progress;

  const signers = record.config.signers;
  const approvedSet = new Set(record.approvals.filter((a) => a.verified).map((a) => a.signer));

  const canSign =
    connectedAddress !== undefined &&
    signers.includes(connectedAddress) &&
    !approvedSet.has(connectedAddress) &&
    !isComplete &&
    record.status === "pending";

  function handleSign() {
    if (!connectedAddress || !onApprove) return;
    setSigning(true);
    // In a real implementation, this would trigger a wallet signature request.
    // For now we produce a stub signature derived from the address.
    const stubSignature = `sig-${connectedAddress}-${Date.now()}`;
    onApprove(connectedAddress, stubSignature);
    setSigning(false);
  }

  const progressPercent = required === 0 ? 100 : Math.min(100, (approved / required) * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Multi-Signature Approval</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isComplete
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {isComplete ? "Threshold Met" : "Pending Approvals"}
        </span>
      </div>

      <p className="mb-2 text-sm text-gray-600">
        {approved} of {required} required approvals
      </p>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={approved}
        aria-valuemin={0}
        aria-valuemax={required}
        className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className={`h-full rounded-full transition-all ${
            isComplete ? "bg-green-500" : "bg-indigo-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Signer list */}
      {signers.length === 0 ? (
        <p className="text-xs text-gray-400">No signers configured.</p>
      ) : (
        <ul className="mb-4 space-y-1">
          {signers.map((addr) => {
            const hasApproved = approvedSet.has(addr);
            return (
              <li key={addr} className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    hasApproved ? "bg-green-500" : "bg-gray-300"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate font-mono text-gray-700" title={addr}>
                  {addr}
                </span>
                <span
                  className={`ml-auto shrink-0 ${
                    hasApproved ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {hasApproved ? "✓ approved" : "pending"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {canSign && (
        <button
          type="button"
          onClick={handleSign}
          disabled={signing}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {signing ? "Signing…" : "Sign & Approve"}
        </button>
      )}
    </div>
  );
}
