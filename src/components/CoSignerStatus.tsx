'use client';

import React from 'react';

export interface CoSigner {
  address: string;
  approved: boolean;
  approvedAt?: string | number | Date | null;
}

export interface CoSignerStatusProps {
  cosigners: CoSigner[];
  threshold: number;
  connectedAddress?: string | null;
  approving?: boolean;
  onApprove?: (address: string) => void | Promise<void>;
  error?: string | null;
}

function truncateAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatApprovedAt(value: string | number | Date): string {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
}

export default function CoSignerStatus({
  cosigners,
  threshold,
  connectedAddress,
  approving = false,
  onApprove,
  error,
}: CoSignerStatusProps) {
  const approvedCount = cosigners.filter((c) => c.approved).length;
  const thresholdMet = approvedCount >= threshold;
  const normalizedConnected = connectedAddress?.trim() ?? '';

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Co-signer approvals
        </h2>
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${
            thresholdMet
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
          data-testid="threshold-indicator"
        >
          {thresholdMet
            ? 'Threshold met'
            : `${approvedCount} of ${threshold} approved`}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {cosigners.length === 0 ? (
        <p className="text-sm text-gray-500">No co-signers required.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cosigners.map((cosigner) => {
            const isConnected =
              normalizedConnected.length > 0 &&
              normalizedConnected === cosigner.address;
            const canApprove =
              isConnected && !cosigner.approved && !approving && !!onApprove;

            return (
              <li
                key={cosigner.address}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`cosigner-${cosigner.address}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span
                    className="truncate font-mono text-sm text-gray-900"
                    title={cosigner.address}
                  >
                    {truncateAddress(cosigner.address)}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        cosigner.approved
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      data-testid={`status-${cosigner.address}`}
                    >
                      {cosigner.approved ? 'Approved' : 'Pending'}
                    </span>
                    {cosigner.approved && cosigner.approvedAt ? (
                      <span className="text-xs text-gray-500">
                        {formatApprovedAt(cosigner.approvedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center sm:justify-end">
                  {canApprove ? (
                    <button
                      type="button"
                      onClick={() => onApprove?.(cosigner.address)}
                      disabled={approving}
                      className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {approving ? 'Approving...' : 'Approve'}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}