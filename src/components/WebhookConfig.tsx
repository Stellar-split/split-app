"use client";

import { useState, useEffect } from "react";

interface Props {
  invoiceId: string;
}

const storageKey = (id: string) => `stellarsplit_webhook_${id}`;

/**
 * WebhookConfig — lets the invoice creator configure a webhook URL that
 * receives POST notifications when the invoice status changes.
 * URL is stored in localStorage keyed by invoice ID.
 * Visible only to the invoice creator (enforced by the parent page).
 */
export default function WebhookConfig({ invoiceId }: Props) {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(invoiceId));
    if (stored) setUrl(stored);
  }, [invoiceId]);

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
    setSaved(true);
  };

  const handleRemove = () => {
    localStorage.removeItem(storageKey(invoiceId));
    setUrl("");
    setSaved(false);
    setDeliveryStatus(null);
  };

  /** Called by the polling mechanism in the parent when status changes. */
  // This function is exported so the parent page can call it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sendWebhook = async (payload: Record<string, unknown>) => {
    const stored = localStorage.getItem(storageKey(invoiceId));
    if (!stored) return;
    try {
      const res = await fetch(stored, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDeliveryStatus(res.ok ? `Delivered (${res.status})` : `Failed (${res.status})`);
    } catch {
      setDeliveryStatus("Delivery failed — network error");
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
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-describedby={error ? "webhook-error" : undefined}
          />
          {error && (
            <p id="webhook-error" role="alert" className="text-red-400 text-xs mt-1">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Save Webhook
          </button>
          {url && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {saved && (
          <p role="status" className="text-green-400 text-sm">
            Webhook URL saved.
          </p>
        )}
        {deliveryStatus && (
          <p role="status" className="text-sm text-gray-300">
            Last delivery: {deliveryStatus}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Sends a webhook POST for the given invoice ID if a URL is stored.
 * Called from the invoice detail page polling loop on status change.
 */
export async function sendWebhookIfConfigured(
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (typeof window === "undefined") return { ok: false };
  const url = localStorage.getItem(storageKey(invoiceId));
  if (!url) return { ok: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
