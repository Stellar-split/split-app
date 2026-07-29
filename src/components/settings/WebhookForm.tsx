"use client";

import { useState } from "react";
import type { WebhookEventType } from "@/app/api/settings/webhooks/store";

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: "invoice.created",  label: "Invoice Created"  },
  { value: "invoice.funded",   label: "Invoice Funded"   },
  { value: "invoice.released", label: "Invoice Released" },
];

interface Props {
  onCreated: (webhook: { id: string; url: string; events: WebhookEventType[]; status: string; createdAt: string; secret: string }) => void;
}

export default function WebhookForm({ onCreated }: Props) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<WebhookEventType>>(new Set());
  const [urlError, setUrlError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleEvent = (e: WebhookEventType) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
    setEventError(null);
  };

  const validate = () => {
    let valid = true;
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      setUrlError(null);
    } catch {
      setUrlError("Enter a valid http(s) URL.");
      valid = false;
    }
    if (events.size === 0) {
      setEventError("Select at least one event type.");
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: Array.from(events) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error ?? "Failed to create webhook.");
        return;
      }
      onCreated(data);
      setUrl("");
      setEvents(new Set());
    } catch {
      setUrlError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Add webhook endpoint"
      className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4"
    >
      <h2 className="text-base font-semibold">Add Endpoint</h2>

      {/* URL field */}
      <div>
        <label htmlFor="wh-url" className="block text-sm font-medium mb-1">
          Endpoint URL
        </label>
        <input
          id="wh-url"
          type="url"
          required
          placeholder="https://example.com/webhook"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
          aria-describedby={urlError ? "wh-url-error" : undefined}
          aria-invalid={urlError ? "true" : undefined}
          className="w-full min-h-10 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {urlError && (
          <p id="wh-url-error" role="alert" className="text-red-500 text-xs mt-1">
            {urlError}
          </p>
        )}
      </div>

      {/* Event checkboxes */}
      <fieldset>
        <legend className="text-sm font-medium mb-2">
          Event Types <span className="text-red-500">*</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {ALL_EVENTS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={events.has(value)}
                onChange={() => toggleEvent(value)}
                className="rounded border-gray-400 text-indigo-600 focus:ring-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>
        {eventError && (
          <p role="alert" className="text-red-500 text-xs mt-1">
            {eventError}
          </p>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {submitting ? "Adding…" : "Add Webhook"}
      </button>
    </form>
  );
}
