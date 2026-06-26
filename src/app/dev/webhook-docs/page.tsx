"use client";

import { useState } from "react";
import { WEBHOOK_SCHEMAS } from "@/lib/webhookSchemas";

export default function WebhookDocsPage() {
  const [search, setSearch] = useState("");
  const [copiedEvent, setCopiedEvent] = useState<string | null>(null);

  const filtered = WEBHOOK_SCHEMAS.filter((s) =>
    s.eventType.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = async (eventType: string, example: Record<string, unknown>) => {
    await navigator.clipboard.writeText(JSON.stringify(example, null, 2));
    setCopiedEvent(eventType);
    setTimeout(() => setCopiedEvent(null), 2000);
  };

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">This tool is only available in dev mode.</p>
        <p className="text-gray-600 text-xs mt-2">Set NEXT_PUBLIC_DEV_MODE=true to enable.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Webhook Payload Schema</h1>
        <p className="text-gray-400 text-sm">
          Reference documentation for all webhook event payloads, their fields, and example data.
        </p>
      </div>

      <div className="mb-8">
        <label htmlFor="schema-search" className="block text-sm font-medium text-gray-300 mb-1">
          Filter by event type
        </label>
        <input
          id="schema-search"
          type="text"
          placeholder="e.g. payment, invoice, refund..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No event types match your search.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {filtered.map((schema) => (
            <section
              key={schema.eventType}
              aria-labelledby={`heading-${schema.eventType}`}
              className="bg-gray-900 rounded-lg p-6"
            >
              <h2
                id={`heading-${schema.eventType}`}
                className="text-lg font-semibold mb-1 text-indigo-400"
              >
                {schema.eventType}
              </h2>
              <p className="text-gray-400 text-sm mb-4">{schema.description}</p>

              {/* Fields Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm text-gray-300">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 font-medium text-gray-400">Field</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-400">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-400">Required</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-400">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.fields.map((field) => (
                      <tr key={field.name} className="border-b border-gray-800">
                        <td className="py-2 px-3 font-mono text-xs text-indigo-300">{field.name}</td>
                        <td className="py-2 px-3 font-mono text-xs">{field.type}</td>
                        <td className="py-2 px-3">
                          {field.required ? (
                            <span className="text-xs font-semibold bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs font-semibold bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                              No
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400">{field.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Example Payload */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Example Payload</h3>
                  <button
                    onClick={() => handleCopy(schema.eventType, schema.example)}
                    className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs font-semibold transition-colors"
                  >
                    {copiedEvent === schema.eventType ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(schema.example, null, 2)}
                </pre>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
