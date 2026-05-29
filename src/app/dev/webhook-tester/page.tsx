"use client";

import { useState } from "react";

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
}

export default function WebhookTesterPage() {
  const [url, setUrl] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<WebhookResponse | null>(null);

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
    try {
      const res = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventType }),
      });
      setResponse(await res.json());
    } catch (err) {
      setResponse({ error: String(err) });
    } finally {
      setSending(false);
    }
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
        <section aria-label="Response inspector" className="flex flex-col gap-4">
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
    </main>
  );
}
