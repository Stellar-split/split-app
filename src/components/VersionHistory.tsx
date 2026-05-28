"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";

interface HistoryEntry {
  action: string;
  timestamp: number;
  oldValue?: string;
  newValue?: string;
  address?: string;
}

interface Props {
  invoiceId: string;
}

export default function VersionHistory({ invoiceId }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const auditLog = await (splitClient as any).getAuditLog(invoiceId);
        
        if (!auditLog || auditLog.length === 0) {
          setHistory([]);
          return;
        }

        const entries: HistoryEntry[] = auditLog.map((entry: any) => {
          const action = entry.action || entry.type;
          const timestamp = entry.timestamp || entry.createdAt;

          if (action === "extend_deadline") {
            return {
              action: "Deadline Extended",
              timestamp,
              oldValue: new Date(entry.oldDeadline * 1000).toLocaleDateString(),
              newValue: new Date(entry.newDeadline * 1000).toLocaleDateString(),
            };
          } else if (action === "add_co_creator") {
            return {
              action: "Co-creator Added",
              timestamp,
              address: entry.address,
            };
          } else if (action === "remove_co_creator") {
            return {
              action: "Co-creator Removed",
              timestamp,
              address: entry.address,
            };
          }

          return {
            action: action.replace(/_/g, " ").charAt(0).toUpperCase() + action.slice(1),
            timestamp,
          };
        });

        setHistory(entries.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">Loading history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm">Failed to load history</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">No changes recorded for this invoice</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => (
        <div
          key={index}
          className="flex gap-4 pb-4 border-b border-gray-700 last:border-b-0"
        >
          {/* Timeline dot */}
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1" />
            {index < history.length - 1 && (
              <div className="w-0.5 h-12 bg-gray-700 mt-2" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pt-0.5">
            <p className="font-semibold text-gray-200">{entry.action}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(entry.timestamp * 1000))}
            </p>

            {/* Diff display */}
            {entry.oldValue && entry.newValue && (
              <div className="mt-2 text-sm space-y-1">
                <p className="text-red-400">
                  <span className="font-mono">- {entry.oldValue}</span>
                </p>
                <p className="text-green-400">
                  <span className="font-mono">+ {entry.newValue}</span>
                </p>
              </div>
            )}

            {entry.address && (
              <p className="mt-2 text-sm font-mono text-gray-300">
                {truncateAddress(entry.address)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
