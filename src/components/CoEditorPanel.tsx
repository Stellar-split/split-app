"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";
import { useInvoiceCollaboration } from "@/hooks/useInvoiceCollaboration";

// ── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  "#6366f1", // indigo
  "#22d3ee", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#a78bfa", // violet
  "#fb923c", // orange
  "#34d399", // green
];

function colorForAddress(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash * 31) + address.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

function contrastTextColor(hex: string): string {
  // Convert hex to RGB and choose white or black text
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111" : "#fff";
}

// ── PresenceDot ──────────────────────────────────────────────────────────────

function PresenceDot({ address, color, field }: { address: string; color: string; field?: string }) {
  const [hover, setHover] = useState(false);
  const short = truncateAddress(address);
  const textColor = contrastTextColor(color);

  return (
    <div className="relative flex items-center gap-2 group">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform hover:scale-110"
        style={{ backgroundColor: color, color: textColor }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={`Collaborator: ${short}${field ? ` editing ${field}` : ""}`}
      >
        {short.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-200 font-mono truncate">{short}</p>
        {field && (
          <p className="text-xs text-gray-500 truncate">
            editing <span className="font-medium" style={{ color }}>{field}</span>
          </p>
        )}
      </div>

      {/* Tooltip on hover */}
      {hover && (
        <div
          role="tooltip"
          className="absolute left-0 bottom-full mb-1.5 z-50 bg-gray-900 text-gray-100 text-xs rounded-lg px-3 py-1.5 shadow-xl border border-white/[0.08] whitespace-nowrap"
        >
          <span className="font-mono">{address}</span>
          {field && <span className="block text-gray-400 mt-0.5">currently editing: {field}</span>}
          <span className="absolute left-4 top-full border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ── FieldHighlight ────────────────────────────────────────────────────────────

/**
 * Wraps an input/textarea with a colored outline when a remote collaborator
 * has that field focused. Usage:
 *
 *   <FieldHighlight fieldName="title" remoteCursors={remoteCursors}>
 *     <input ... />
 *   </FieldHighlight>
 */
export function FieldHighlight({
  fieldName,
  remoteCursors,
  children,
  className,
}: {
  fieldName: string;
  remoteCursors: { address: string; field: string; color: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  const activeEditors = remoteCursors.filter((c) => c.field === fieldName);
  const firstColor = activeEditors[0]?.color;

  return (
    <div
      className={`relative ${className ?? ""}`}
      aria-label={
        activeEditors.length > 0
          ? `Field being edited by ${activeEditors.map((e) => truncateAddress(e.address)).join(", ")}`
          : undefined
      }
    >
      {children}

      {/* Glowing border overlay */}
      {firstColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg border-2 transition-colors"
          style={{
            borderColor: firstColor,
            boxShadow: `0 0 0 3px ${firstColor}30`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Editor badges at top-right of field */}
      {activeEditors.length > 0 && (
        <div className="absolute -top-3 right-1 flex gap-0.5 pointer-events-none" aria-hidden="true">
          {activeEditors.slice(0, 3).map((e) => (
            <span
              key={e.address}
              className="w-4 h-4 rounded-full border border-gray-900 text-xs flex items-center justify-center font-bold"
              style={{ backgroundColor: e.color, color: contrastTextColor(e.color) }}
            >
              {truncateAddress(e.address).charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ConnectionIndicator ───────────────────────────────────────────────────────

function ConnectionIndicator({
  isConnected,
  error,
}: {
  isConnected: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
        Disconnected
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-400">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
        Connecting…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
      Live
    </div>
  );
}

// ── CoEditorPanel ─────────────────────────────────────────────────────────────

interface CoEditorPanelProps {
  invoiceId: string;
  currentAddress: string | null;
  hasWritePermission?: boolean;
}

/**
 * Sidebar panel showing real-time collaborators, their field focus, and
 * connection status. Renders an empty/collapsed state when offline.
 */
export default function CoEditorPanel({
  invoiceId,
  currentAddress,
  hasWritePermission = true,
}: CoEditorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [permDeniedMessage, setPermDeniedMessage] = useState<string | null>(null);
  const permDeniedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePermissionDenied = useCallback(() => {
    setPermDeniedMessage("You have read-only access to this invoice.");
    if (permDeniedTimerRef.current) clearTimeout(permDeniedTimerRef.current);
    permDeniedTimerRef.current = setTimeout(() => setPermDeniedMessage(null), 5000);
  }, []);

  const {
    remoteCursors,
    remotePresence,
    isConnected,
    connectionError,
  } = useInvoiceCollaboration({
    invoiceId,
    currentAddress,
    hasWritePermission,
    onPermissionDenied: handlePermissionDenied,
  });

  useEffect(() => {
    return () => {
      if (permDeniedTimerRef.current) clearTimeout(permDeniedTimerRef.current);
    };
  }, []);

  const activeCount = remotePresence.filter((p) => p.online).length;
  const totalEditing = remoteCursors.length;

  return (
    <div
      className="flex flex-col gap-2 p-3 bg-gray-900 rounded-xl border border-gray-700 min-w-0 w-full"
      aria-label="Collaboration panel"
      role="complementary"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold text-gray-300 whitespace-nowrap">Co-editors</h2>
          {activeCount > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">
              {activeCount} online
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionIndicator isConnected={isConnected} error={connectionError} />
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={collapsed ? "Expand collaboration panel" : "Collapse collaboration panel"}
            aria-expanded={!collapsed}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Permission denied message */}
      {permDeniedMessage && (
        <p role="alert" className="text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1.5">
          {permDeniedMessage}
        </p>
      )}

      {/* Collapsed state: show avatar row only */}
      {collapsed ? (
        <div className="flex items-center gap-1 -space-x-1.5">
          {remotePresence.slice(0, 5).map((p) => {
            const color = colorForAddress(p.address);
            const short = truncateAddress(p.address);
            const textColor = contrastTextColor(color);
            return (
              <div
                key={p.address}
                className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: color, color: textColor }}
                title={short}
                aria-label={short}
              >
                {short.charAt(0).toUpperCase()}
              </div>
            );
          })}
          {remotePresence.length > 5 && (
            <span className="text-xs text-gray-500 pl-3">+{remotePresence.length - 5}</span>
          )}
        </div>
      ) : (
        <>
          {/* No collaborators */}
          {remotePresence.length === 0 && remoteCursors.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              {isConnected ? "No other editors online." : "Waiting for connection…"}
            </p>
          )}

          {/* Online presence list */}
          {remotePresence.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Online</p>
              <ul className="flex flex-col gap-2" aria-label="Online collaborators">
                {remotePresence
                  .filter((p) => p.online)
                  .map((p) => {
                    const cursor = remoteCursors.find((c) => c.address === p.address);
                    return (
                      <li key={p.address}>
                        <PresenceDot
                          address={p.address}
                          color={colorForAddress(p.address)}
                          field={cursor?.field}
                        />
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {/* Active field edits */}
          {totalEditing > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-gray-800 pt-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Currently editing
              </p>
              <ul className="flex flex-col gap-1.5" aria-label="Fields being edited">
                {remoteCursors.map((c) => (
                  <li key={c.address} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                      aria-hidden="true"
                    />
                    <span className="text-gray-400 font-mono truncate">{truncateAddress(c.address)}</span>
                    <span className="text-gray-600 shrink-0">→</span>
                    <span className="font-medium truncate" style={{ color: c.color }}>{c.field}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Current user */}
          {currentAddress && (
            <div className="border-t border-gray-800 pt-2 flex items-center gap-2 text-xs text-gray-500">
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span className="font-mono truncate">{truncateAddress(currentAddress)}</span>
              <span className="shrink-0 text-emerald-400">(you)</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
