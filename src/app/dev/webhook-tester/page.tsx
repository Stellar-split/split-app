"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDeadLettered,
  retryDeadLettered,
  getDeliveryHistory,
  addDeliveryHistoryEntry,
  replayDelivery,
  type DeadLetteredDelivery,
  type DeliveryHistoryEntry,
} from "@/lib/webhookDeliveryQueue";

const EVENT_TYPES = [
  "invoice.created",
  "invoice.paid",
  "invoice.released",
  "invoice.refunded",
];

interface WebhookResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  latencyMs?: number;
  error?: string;
  sentPayload?: Record<string, unknown>;
}

export default function WebhookTesterPage() {
  const [url, setUrl] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<WebhookResponse | null>(null);
  const [dlq, setDlq] = useState<DeadLetteredDelivery[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([]);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [replayResult, setReplayResult] = useState<Record<string, string>>({});

  const refreshDlq = useCallback(() => setDlq(getDeadLettered()), []);
  const refreshHistory = useCallback(() => setHistory(getDeliveryHistory()), []);

  useEffect(() => {
    refreshDlq();
    refreshHistory();
  }, [refreshDlq, refreshHistory]);

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">This tool is only available in dev mode.</p>
        <p className="text-gray-600 text-xs mt-2">Set NEXT_PUBLIC_DEV_MODE=true to enable.</p>
      </main>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setSending(true);
    setResponse(null);
    const sentAt = Date.now();
    try {
      const res = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventType }),
      });
      const data: WebhookResponse = await res.json();
      setResponse(data);
      if (data.sentPayload) {
        addDeliveryHistoryEntry({
          url,
          payload: data.sentPayload,
          sentAt,
          status: data.status !== undefined && data.status >= 200 && data.status < 300 ? "success" : "failed",
          statusCode: data.status,
          error: data.error,
          isReplay: false,
        });
        refreshHistory();
      }
    } catch (err) {
      setResponse({ error: String(err) });
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    setRetryResult((prev) => ({ ...prev, [id]: "" }));
    const result = await retryDeadLettered(id);
    setRetryResult((prev) => ({
      ...prev,
      [id]: result.ok ? "✓ Retry succeeded" : `✗ ${result.error}`,
    }));
    setRetrying(null);
    refreshDlq();
  };

  const handleReplay = async (id: string) => {
    if (!url) return;
    setReplaying(id);
    setReplayResult((prev) => ({ ...prev, [id]: "" }));
    const result = await replayDelivery(id, url);
    setReplayResult((prev) => ({
      ...prev,
      [id]: result.ok ? "✓ Replay succeeded" : `✗ ${result.error ?? "Failed"}`,
    }));
    setReplaying(null);
    refreshHistory();
  };

  const statusBadgeClass =
    response?.status !== undefined
      ? response.status >= 200 && response.status < 300
        ? "bg-green-900 text-green-300"
        : "bg-red-900 text-red-300"
      : "";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Webhook Tester</h1>
        <p className="text-gray-400 text-sm">
          Send a sample invoice event payload to any URL and inspect the full request/response.
        </p>
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-4 mb-8">
        <div>
          <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-300 mb-1">
            Target URL
          </label>
          <input
            id="webhook-url"
            type="url"
            placeholder="https://example.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="event-type" className="block text-sm font-medium text-gray-300 mb-1">
            Event Type
          </label>
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={sending}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send Test"}
        </button>
      </form>

      {response && (
        <section aria-label="Response inspector" className="flex flex-col gap-4 mb-12">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Response</h2>
            {response.status !== undefined && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                {response.status}
              </span>
            )}
            {response.latencyMs !== undefined && (
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                {response.latencyMs}ms
              </span>
            )}
          </div>

          {response.error && (
            <p className="text-red-400 text-sm" role="alert">{response.error}</p>
          )}

          {response.headers && Object.keys(response.headers).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Headers</h3>
              <pre className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 overflow-x-auto">
                {Object.entries(response.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </pre>
            </div>
          )}

          {response.body !== undefined && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Body</h3>
              <pre className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(response.body!), null, 2);
                  } catch {
                    return response.body;
                  }
                })()}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Delivery History */}
      <section aria-labelledby="history-heading" className="border-t border-gray-800 pt-8 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 id="history-heading" className="text-lg font-semibold">
            Delivery History
            {history.length > 0 && (
              <span className="ml-2 text-xs font-normal bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </h2>
          <button
            onClick={refreshHistory}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">No deliveries yet. Send a test event above.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="bg-gray-900 rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          entry.status === "success"
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}
                      >
                        {entry.statusCode ?? (entry.status === "success" ? "OK" : "ERR")}
                      </span>
                      {entry.isReplay && (
                        <span className="text-xs font-semibold bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">
                          replay
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(entry.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 truncate max-w-xs" title={entry.url}>
                      {entry.url}
                    </span>
                    {entry.error && (
                      <span className="text-xs text-red-400">{entry.error}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleReplay(entry.id)}
                    disabled={replaying === entry.id || !url}
                    title={!url ? "Enter a target URL above to replay" : undefined}
                    className="min-h-9 px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-xs font-semibold shrink-0 transition-colors"
                  >
                    {replaying === entry.id ? "Replaying…" : "Replay"}
                  </button>
                </div>

                {replayResult[entry.id] && (
                  <p
                    className={`text-xs ${replayResult[entry.id].startsWith("✓") ? "text-green-400" : "text-red-400"}`}
                    role="status"
                  >
                    {replayResult[entry.id]}
                  </p>
                )}

                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                    Payload
                  </summary>
                  <pre className="mt-2 bg-gray-800 rounded px-3 py-2 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dead-Letter Queue */}
      <section aria-labelledby="dlq-heading" className="border-t border-gray-800 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 id="dlq-heading" className="text-lg font-semibold">
            Dead-Letter Queue
            {dlq.length > 0 && (
              <span className="ml-2 text-xs font-normal bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
                {dlq.length}
              </span>
            )}
          </h2>
          <button
            onClick={refreshDlq}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        {dlq.length === 0 ? (
          <p className="text-gray-500 text-sm">No failed deliveries.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {dlq.map((item) => (
              <li
                key={item.id}
                className="bg-gray-900 rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs text-gray-400">
                      {new Date(item.failedAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 truncate max-w-xs" title={item.url}>
                      {item.url}
                    </span>
                    <span className="text-xs text-red-400">{item.lastError}</span>
                  </div>
                  <button
                    onClick={() => handleRetry(item.id)}
                    disabled={retrying === item.id}
                    className="min-h-9 px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-xs font-semibold shrink-0 transition-colors"
                  >
                    {retrying === item.id ? "Retrying…" : "Retry now"}
                  </button>
                </div>

                {retryResult[item.id] && (
                  <p
                    className={`text-xs ${retryResult[item.id].startsWith("✓") ? "text-green-400" : "text-red-400"}`}
                    role="status"
                  >
                    {retryResult[item.id]}
                  </p>
                )}

                <details className="mt-1">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                    Payload
                  </summary>
                  <pre className="mt-2 bg-gray-800 rounded px-3 py-2 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
