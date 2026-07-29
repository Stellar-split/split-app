"use client";

import { useEffect, useState } from "react";
import WebhookForm from "@/components/settings/WebhookForm";
import type { WebhookEventType } from "@/app/api/settings/webhooks/store";

interface Webhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  status: "active" | "disabled";
  createdAt: string;
}

/** One-time secret reveal modal shown after create or rotate. */
function SecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret).then(() => setCopied(true));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
    >
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-6 space-y-4">
        <h2 id="secret-modal-title" className="text-base font-semibold">
          Webhook Secret — Save it now
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This secret is shown only once. Use it to verify the{" "}
          <code className="text-xs">X-Webhook-Signature</code> header on incoming requests.
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 break-all bg-gray-100 dark:bg-neutral-800 rounded px-3 py-2 text-xs">
            {secret}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            aria-label="Copy secret to clipboard"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ You will not be able to retrieve this secret again.
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            I&apos;ve saved it
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation dialog for delete. */
function ConfirmDeleteModal({ url, onConfirm, onCancel }: { url: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
    >
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-6 space-y-4">
        <h2 id="confirm-delete-title" className="text-base font-semibold">
          Delete webhook?
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
          This will permanently remove the endpoint <strong>{url}</strong>. Deliveries will stop immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);

  const loadWebhooks = async () => {
    try {
      const res = await fetch("/api/settings/webhooks");
      if (res.ok) setWebhooks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWebhooks(); }, []);

  const handleCreated = (data: Webhook & { secret: string }) => {
    const { secret, ...webhook } = data;
    setWebhooks((prev) => [webhook, ...prev]);
    setRevealSecret(secret);
  };

  const handleDelete = async (webhook: Webhook) => {
    const res = await fetch(`/api/settings/webhooks/${webhook.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
    }
    setDeleteTarget(null);
  };

  const handleRotate = async (id: string) => {
    const res = await fetch(`/api/settings/webhooks/${id}`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setRevealSecret(data.secret);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Register HTTPS endpoints to receive real-time payment event notifications.
        </p>
      </div>

      {/* Add form */}
      <WebhookForm onCreated={handleCreated} />

      {/* Endpoint list */}
      <section aria-label="Registered webhook endpoints">
        <h2 className="text-base font-semibold mb-3">Registered Endpoints</h2>

        {loading && (
          <p className="text-sm text-gray-500">Loading…</p>
        )}

        {!loading && webhooks.length === 0 && (
          <p className="text-sm text-gray-500">No webhooks configured yet.</p>
        )}

        <ul className="space-y-3">
          {webhooks.map((wh) => (
            <li
              key={wh.id}
              className="flex flex-col sm:flex-row sm:items-start gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-all">{wh.url}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {wh.events.map((ev) => (
                    <span
                      key={ev}
                      className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Added {new Date(wh.createdAt).toLocaleString()} ·{" "}
                  <span className={wh.status === "active" ? "text-green-500" : "text-gray-400"}>
                    {wh.status}
                  </span>
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleRotate(wh.id)}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={`Rotate secret for ${wh.url}`}
                >
                  Rotate secret
                </button>
                <button
                  onClick={() => setDeleteTarget(wh)}
                  className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                  aria-label={`Delete webhook ${wh.url}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* One-time secret reveal modal */}
      {revealSecret && (
        <SecretModal secret={revealSecret} onClose={() => setRevealSecret(null)} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          url={deleteTarget.url}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
