"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { downloadCSV } from "@/lib/csvExport";

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  createdAt: number;
  lastUsed?: number | null;
};

export type ApiRequestLog = {
  id: string;
  timestamp: number;
  endpoint: string;
  keyId: string;
  statusCode: number;
};

const KEYS_STORAGE = "apiKeys";
const LOGS_STORAGE = "apiLogs";
const ITEMS_PER_PAGE = 10;

function loadKeys(): ApiKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw) as ApiKey[];
  } catch (e) {
    return [];
  }
}

function loadLogs(): ApiRequestLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOGS_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw) as ApiRequestLog[];
  } catch (e) {
    return [];
  }
}

function escapeCSVField(field: string): string {
  if (!field) return "";
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function ApiLogsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);

  const [selectedKeyId, setSelectedKeyId] = useState<string>("all");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Seed mock data if localStorage is empty (facilitates testing and previewing)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let currentKeys = loadKeys();
    if (currentKeys.length === 0) {
      currentKeys = [
        {
          id: "key-1",
          name: "Production Gateway",
          key: "sk_prod_5a9b8",
          createdAt: Date.now() - 30 * 86400000,
          lastUsed: Date.now() - 3600000,
        },
        {
          id: "key-2",
          name: "Staging Tester",
          key: "sk_stag_0e2b1",
          createdAt: Date.now() - 10 * 86400000,
          lastUsed: Date.now() - 7200000,
        },
        {
          id: "key-3",
          name: "Internal CLI",
          key: "sk_cli_c3d8f",
          createdAt: Date.now() - 5 * 86400000,
          lastUsed: Date.now() - 1800000,
        },
      ];
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(currentKeys));
    }
    setKeys(currentKeys);

    let currentLogs = loadLogs();
    if (currentLogs.length === 0) {
      const endpoints = [
        "/api/invoices",
        "/api/invoices/new",
        "/api/test-webhook",
        "/api/send-confirmation",
        "/api/pay",
      ];
      const statuses = [200, 201, 400, 401, 500];
      const keyIds = currentKeys.map((k) => k.id);
      const seededLogs: ApiRequestLog[] = [];
      const now = Date.now();

      // Seed 55 logs to cover pagination
      for (let i = 0; i < 55; i++) {
        const ageInMs = i * 4 * 3600000 + Math.random() * 3600000;
        const timestamp = now - ageInMs;
        const endpoint = endpoints[i % endpoints.length];
        const keyId = keyIds[i % keyIds.length];

        const rand = Math.random();
        let statusCode = 200;
        if (rand > 0.8) {
          statusCode = statuses[2 + Math.floor(Math.random() * 3)]; // 400, 401, or 500
        } else if (endpoint === "/api/invoices/new" && Math.random() > 0.5) {
          statusCode = 201;
        }

        seededLogs.push({
          id: `log-${i}`,
          timestamp,
          endpoint,
          keyId,
          statusCode,
        });
      }
      localStorage.setItem(LOGS_STORAGE, JSON.stringify(seededLogs));
      currentLogs = seededLogs;
    }
    setLogs(currentLogs);
  }, []);

  // Map of keyId to keyName
  const keyMap = useMemo(() => {
    const map = new Map<string, string>();
    keys.forEach((k) => map.set(k.id, k.name));
    return map;
  }, [keys]);

  // Key filter dropdown options (includes active keys + revoked/unknown keys found in logs)
  const keyFilterOptions = useMemo(() => {
    const activeOptions = keys.map((k) => ({ id: k.id, name: k.name }));
    const activeIds = new Set(keys.map((k) => k.id));
    const revokedIds = new Set<string>();

    logs.forEach((log) => {
      if (log.keyId && !activeIds.has(log.keyId)) {
        revokedIds.add(log.keyId);
      }
    });

    const revokedOptions = Array.from(revokedIds).map((id) => ({
      id,
      name: `Revoked Key (${id.substring(0, 8)})`,
    }));

    return [...activeOptions, ...revokedOptions];
  }, [keys, logs]);

  // Endpoint filter options
  const endpointFilterOptions = useMemo(() => {
    const endpoints = new Set<string>();
    logs.forEach((log) => {
      if (log.endpoint) {
        endpoints.add(log.endpoint);
      }
    });
    return Array.from(endpoints).sort();
  }, [logs]);

  // Combined filters logic
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (selectedKeyId !== "all" && log.keyId !== selectedKeyId) {
          return false;
        }
        if (selectedEndpoint !== "all" && log.endpoint !== selectedEndpoint) {
          return false;
        }
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (log.timestamp < start.getTime()) {
            return false;
          }
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (log.timestamp > end.getTime()) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, selectedKeyId, selectedEndpoint, startDate, endDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedKeyId, selectedEndpoint, startDate, endDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = ["Timestamp", "Endpoint", "API Key", "Status Code"];
    const rows = [headers.join(",")];

    for (const log of filteredLogs) {
      const keyName = keyMap.get(log.keyId) || `Revoked Key (${log.keyId})`;
      const dateStr = new Date(log.timestamp).toISOString();
      const row = [
        escapeCSVField(dateStr),
        escapeCSVField(log.endpoint),
        escapeCSVField(keyName),
        String(log.statusCode),
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");
    const fileDate = new Date().toISOString().split("T")[0];
    downloadCSV(csvContent, `api-request-logs-${fileDate}.csv`);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedKeyId("all");
    setSelectedEndpoint("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">API Logs</h1>
        <Link href="/settings/api-keys" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          Go to API Keys
        </Link>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
        <Link
          href="/settings/api-keys"
          className="px-4 py-2 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          API Keys
        </Link>
        <Link
          href="/settings/api-logs"
          className="px-4 py-2 border-b-2 border-indigo-600 dark:border-indigo-400 font-medium text-sm text-indigo-600 dark:text-indigo-400"
        >
          Request Logs
        </Link>
      </div>

      {/* Filter panel */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4 shadow-sm mb-6">
        <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
            <select
              aria-label="Filter by API Key"
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-neutral-850 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded px-2.5 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Keys</option>
              {keyFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
            <select
              aria-label="Filter by Endpoint"
              value={selectedEndpoint}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="w-full bg-gray-50 dark:bg-neutral-850 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded px-2.5 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Endpoints</option>
              {endpointFilterOptions.map((end) => (
                <option key={end} value={end}>
                  {end}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              aria-label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-neutral-850 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded px-2.5 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              aria-label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-neutral-850 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded px-2.5 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {(selectedKeyId !== "all" || selectedEndpoint !== "all" || startDate || endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Info & Export Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredLogs.length > 0 ? (
            <span>
              Showing {startIndex + 1}–{endIndex} of {filteredLogs.length} request logs
            </span>
          ) : (
            <span>No request logs found</span>
          )}
        </div>

        {filteredLogs.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded shadow-sm transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-neutral-850 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-neutral-800 font-medium">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">API Key</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-neutral-800 text-gray-900 dark:text-gray-100">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No request logs match the current filters.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => {
                const keyName = keyMap.get(log.keyId) || `Revoked Key (${log.keyId.substring(0, 8)})`;
                const dateStr = new Date(log.timestamp).toLocaleString();
                const is2xx = log.statusCode >= 200 && log.statusCode < 300;
                const is4xx = log.statusCode >= 400 && log.statusCode < 500;
                const is5xx = log.statusCode >= 500;

                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-neutral-850 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{dateStr}</td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={log.endpoint}>
                      {log.endpoint}
                    </td>
                    <td className="px-4 py-3 text-sm truncate max-w-[180px]" title={keyName}>
                      {keyName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${
                          is2xx
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : is4xx
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : is5xx
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border border-gray-300 dark:border-neutral-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-neutral-800"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 border border-gray-300 dark:border-neutral-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-neutral-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
