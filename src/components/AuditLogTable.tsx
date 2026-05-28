"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";

interface AuditLogEntry {
  action: string;
  actor: string;
  timestamp: number;
}

interface Props {
  invoiceId: string;
}

const ENTRIES_PER_PAGE = 10;

export default function AuditLogTable({ invoiceId }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchAuditLog = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = await (splitClient as any).getAuditLog(invoiceId);
        setEntries(log || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLog();
  }, [invoiceId]);

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
        <p className="text-gray-400 text-sm">Loading audit log…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
        <p className="text-gray-400 text-sm">No audit log entries.</p>
      </section>
    );
  }

  const totalPages = Math.ceil(entries.length / ENTRIES_PER_PAGE);
  const startIdx = (currentPage - 1) * ENTRIES_PER_PAGE;
  const paginatedEntries = entries.slice(startIdx, startIdx + ENTRIES_PER_PAGE);

  const formatTimestamp = (timestamp: number): string => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).format(new Date(timestamp * 1000));
    } catch {
      return new Date(timestamp * 1000).toISOString();
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Audit Log</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-2 font-semibold text-gray-300">Action</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-300">Actor</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-300">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.map((entry, idx) => (
              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-900/50">
                <td className="px-4 py-3 text-gray-200">{entry.action}</td>
                <td className="px-4 py-3 font-mono text-gray-400 truncate" title={entry.actor}>
                  {truncateAddress(entry.actor)}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {formatTimestamp(entry.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm disabled:opacity-50 disabled:cursor-default"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm disabled:opacity-50 disabled:cursor-default"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
