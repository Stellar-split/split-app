"use client";

import { useState, useEffect } from "react";

interface Props {
  invoiceId: string;
}

interface DeliveryLog {
  timestamp: number;
  status: number | null;
  success: boolean;
  event: string;
}

const storageKey = (id: string) => `stellarsplit_webhook_${id}`;
const logKey = (id: string) => `stellarsplit_webhook_log_${id}`;
const secretKey = (id: string) => `stellarsplit_webhook_secret_${id}`;

/**
 * WebhookConfig — lets the invoice creator configure a webhook URL that
 * receives POST notifications when the invoice status changes.
 * URL is stored in localStorage keyed by invoice ID.
 * Visible only to the invoice creator (enforced by the parent page).
 */
export default function WebhookConfig({ invoiceId }: Props) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(invoiceId));
    if (stored) setUrl(stored);
    const storedSecret = localStorage.getItem(secretKey(invoiceId));
    if (storedSecret) setSecret(storedSecret);
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const loadLogs = () => {
    const stored = localStorage.getItem(logKey(invoiceId));
    if (stored) {
      try {
        setLogs(JSON.parse(stored));
      } catch {
        setLogs([]);
      }
    }
  };

  const addLog = (log: DeliveryLog) => {
    const updated = [log, ...logs].slice(0, 10);
    localStorage.setItem(logKey(invoiceId), JSON.stringify(updated));
    setLogs(updated);
  };

  const validate = (value: string): boolean => {
    try {
      const u = new URL(value);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    setError(null);
    setSaved(false);
    if (!validate(url)) {
      setError("URL must be a valid https:// endpoint.");
      return;
    }
    localStorage.setItem(storageKey(invoiceId), url);
    if (secret) {
      localStorage.setItem(secretKey(invoiceId), secret);
    } else {
      localStorage.removeItem(secretKey(invoiceId));
    }
    setSaved(true);
  };

  const handleRemove = () => {
    localStorage.removeItem(storageKey(invoiceId));
    localStorage.removeItem(secretKey(invoiceId));
    setUrl("");
    setSecret("");
    setSaved(false);
    setTestStatus(null);
  };

  const handleTestWebhook = async () => {
    if (!url) {
      setTestStatus("No webhook URL configured");
      return;
    }
    setTesting(true);
    setTestStatus(null);
    try {
      const { enqueue, processQueue } = await import("@/lib/webhookDeliveryQueue");
      const payload = { event: "test", invoiceId, timestamp: new Date().toISOString() };
      enqueue(payload, url, secret || undefined);
      await processQueue();
      setTestStatus("✓ Queued and attempted. Check dead-letter queue if it failed.");
      addLog({ timestamp: Date.now(), status: null, success: true, event: "test" });
    } catch (e) {
      setTestStatus(`✗ Error: ${String(e)}`);
      addLog({ timestamp: Date.now(), status: null, success: false, event: "test" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section aria-labelledby="webhook-heading" className="mt-8 border-t border-gray-800 pt-6">
      <h2 id="webhook-heading" className="text-lg font-semibold mb-3">
        Webhook Notifications
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        Receive a POST request to your server when this invoice status changes.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-300 mb-1">
            Webhook URL (https only)
          </label>
          <input
            id="webhook-url"
            type="url"
            placeholder="https://your-server.com/webhook"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); setError(null); }}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-describedby={error ? "webhook-error" : undefined}
          />
          {error && (
            <p id="webhook-error" role="alert" className="text-red-400 text-xs mt-1">
              {error}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="webhook-secret" className="block text-sm font-medium text-gray-300 mb-1">
            Webhook Secret (optional)
          </label>
          <input
            id="webhook-secret"
            type="password"
            placeholder="Your secret key for HMAC SHA-256 signature"
            value={secret}
            onChange={(e) => { setSecret(e.target.value); setSaved(false); }}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            If provided, a signature will be sent in the <code>X-Webhook-Signature</code> header.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSave}
            className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Save Webhook
          </button>
          {url && (
            <>
              <button
                onClick={handleTestWebhook}
                disabled={testing}
                className="min-h-11 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-sm font-semibold transition-colors"
              >
                {testing ? "Testing..." : "Test Webhook"}
              </button>
              <button
                onClick={handleRemove}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
              >
                Remove
              </button>
            </>
          )}
        </div>

        {saved && (
          <p role="status" className="text-green-400 text-sm">
            Webhook URL saved.
          </p>
        )}
        {testStatus && (
          <p role="status" className="text-sm text-gray-300">
            Test result: {testStatus}
          </p>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          <h3 className="text-sm font-semibold mb-3">Delivery Log (Last 10)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-gray-300">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2">Timestamp</th>
                  <th className="text-left py-2 px-2">Event</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className="py-2 px-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-2">{log.event}</td>
                    <td className="py-2 px-2">{log.status || "—"}</td>
                    <td className="py-2 px-2">
                      <span className={log.success ? "text-green-400" : "text-red-400"}>
                        {log.success ? "✓ Success" : "✗ Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Enqueues a webhook delivery for the given invoice ID if a URL is stored.
 * Delivery is attempted with exponential backoff; failures go to the dead-letter queue.
 */
export async function sendWebhookIfConfigured(
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; queued?: boolean }> {
  if (typeof window === "undefined") return { ok: false };
  const url = localStorage.getItem(storageKey(invoiceId));
  const secret = localStorage.getItem(secretKey(invoiceId));
  if (!url) return { ok: false };
  const { enqueue, processQueue } = await import("@/lib/webhookDeliveryQueue");
  enqueue(payload, url, secret || undefined);
  await processQueue();
  return { ok: true, queued: true };
}
