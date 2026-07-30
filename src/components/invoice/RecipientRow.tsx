"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEmailValidation } from "@/hooks/useEmailValidation";
import RecipientPaymentHistory from "@/components/invoice/RecipientPaymentHistory";

// ─── Form Row (invoice creation) ──────────────────────────────────────────

interface RecipientRowProps {
  email: string;
  onEmailChange: (email: string) => void;
  onBlur?: () => void;
}

export default function RecipientRow({
  email,
  onEmailChange,
  onBlur,
}: RecipientRowProps) {
  const { isValidFormat, isCheckingMX, mxValid } = useEmailValidation(email);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onBlur}
          placeholder="recipient@example.com"
          className={`flex-1 bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 ${
            !email
              ? "border-gray-700 focus:ring-indigo-500"
              : !isValidFormat
                ? "border-red-500 focus:ring-red-500"
                : mxValid === false
                  ? "border-yellow-500 focus:ring-yellow-500"
                  : "border-green-500 focus:ring-green-500"
          }`}
        />
        {email && isValidFormat && (
          <>
            {isCheckingMX && (
              <span className="text-xs text-gray-400">Checking...</span>
            )}
            {!isCheckingMX && mxValid === true && (
              <span className="text-green-500">✓</span>
            )}
            {!isCheckingMX && mxValid === false && (
              <span className="text-yellow-500">⚠</span>
            )}
          </>
        )}
      </div>

      {email && !isValidFormat && (
        <p className="text-xs text-red-400">Invalid email format</p>
      )}
      {email && isValidFormat && mxValid === false && !isCheckingMX && (
        <p className="text-xs text-yellow-400">Domain has no MX records (delivery may fail)</p>
      )}
    </div>
  );
}

// ─── Invoice Detail Row (with payment history panel) ──────────────────────

export interface RecipientDetailRowProps {
  /** Stellar address of the recipient */
  address: string;
  /** Share percentage (0–100) */
  sharePercent: string;
  /** Expected payout amount, formatted */
  formattedAmount: string;
  /** Payment status label */
  status: string;
  /** Status badge CSS classes */
  statusBadgeClass: string;
  /** Whether this row belongs to the connected wallet */
  isCurrentWallet?: boolean;
  /** Invoice id — used to build the history API URL */
  invoiceId: string;
  /** Stellar network for explorer links */
  network?: "testnet" | "mainnet";
  /** Optional action slot (e.g. Claim button) */
  actionSlot?: React.ReactNode;
}

/**
 * RecipientDetailRow — a `<tr>` with an expandable payment history panel.
 *
 * The history panel is fetched lazily on first expand and cached by the
 * RecipientPaymentHistory component for the page session.
 */
export function RecipientDetailRow({
  address,
  sharePercent,
  formattedAmount,
  status,
  statusBadgeClass,
  isCurrentWallet = false,
  invoiceId,
  network = "testnet",
  actionSlot,
}: RecipientDetailRowProps) {
  const [expanded, setExpanded] = useState(false);

  const truncated = `${address.slice(0, 8)}...${address.slice(-6)}`;

  return (
    <>
      <tr
        className={
          isCurrentWallet
            ? "bg-indigo-500/10 border-b border-indigo-400/20"
            : "border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors"
        }
      >
        {/* Chevron toggle */}
        <td className="px-2 py-3 w-8">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Collapse payment history for ${truncated}`
                : `Expand payment history for ${truncated}`
            }
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {expanded ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        </td>

        {/* Address */}
        <td
          className="px-4 py-3 text-sm font-mono text-gray-300 truncate max-w-[200px]"
          title={address}
        >
          <span className="sm:hidden">{truncated}</span>
          <span className="hidden sm:inline">{address}</span>
          {isCurrentWallet && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-semibold inline-flex items-center gap-1">
              You
            </span>
          )}
        </td>

        {/* Share */}
        <td className="px-4 py-3 text-sm text-gray-300 text-right">
          {sharePercent}%
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-sm text-indigo-300 font-medium text-right tabular-nums">
          {formattedAmount}
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-sm text-right">
          <span
            className={`text-xs px-2 py-1 rounded-full font-semibold inline-block ${statusBadgeClass}`}
          >
            {status}
          </span>
        </td>

        {/* Action slot */}
        <td className="px-4 py-3 text-right">{actionSlot}</td>
      </tr>

      {/* Expanded history panel spans all columns */}
      {expanded && (
        <tr aria-live="polite">
          <td colSpan={6} className="p-0">
            <RecipientPaymentHistory
              invoiceId={invoiceId}
              recipientId={address}
              network={network}
            />
          </td>
        </tr>
      )}
    </>
  );
}
