"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { encodeTemplate } from "@/lib/templateSharing";
import { type UserTemplate, loadTemplates, saveTemplates } from "@/components/TemplateManager";

const MAX_TEMPLATES = 20;

function totalAmount(recipients: UserTemplate["recipients"]): number {
  return recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const flash = (text: string, error = false) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3000);
  };

  const persist = (updated: UserTemplate[]) => {
    saveTemplates(updated);
    setTemplates(updated);
  };

  const handleUse = (index: number) => {
    const t = templates[index];
    if (!t) return;
    const updated = templates.map((tmpl, i) =>
      i !== index ? tmpl : { ...tmpl, lastUsed: new Date().toISOString() }
    );
    persist(updated);
    const encoded = encodeTemplate({ recipients: t.recipients, token: t.token });
    router.push(`/invoice/new?template=${encoded}`);
  };

  const handleDelete = (index: number) => {
    persist(templates.filter((_, i) => i !== index));
    flash("Template deleted");
  };

  const handleRenameStart = (index: number) => {
    setEditingIndex(index);
    setEditName(templates[index]?.name ?? "");
  };

  const handleRenameConfirm = () => {
    if (editingIndex === null) return;
    const name = editName.trim();
    if (!name) { setEditingIndex(null); return; }
    persist(templates.map((t, i) => (i !== editingIndex ? t : { ...t, name })));
    setEditingIndex(null);
    flash("Template renamed");
  };

  const handleExport = () => {
    const json = JSON.stringify(templates, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stellarsplit-templates.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Templates exported");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: UserTemplate[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error();
        const merged = [...templates];
        let added = 0;
        for (const t of parsed) {
          if (merged.length >= MAX_TEMPLATES) break;
          if (typeof t.name === "string" && Array.isArray(t.recipients)) {
            merged.push(t);
            added++;
          }
        }
        persist(merged);
        flash(`Imported ${added} template${added !== 1 ? "s" : ""}`);
      } catch {
        flash("Import failed — invalid JSON", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Templates</h1>
            <p className="text-gray-400 text-sm mt-1">
              {templates.length}/{MAX_TEMPLATES} templates saved
            </p>
          </div>

          <div className="flex gap-2">
            {templates.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors"
              >
                Export JSON
              </button>
            )}
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors"
            >
              Import JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Link
              href="/invoice/new"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
            >
              + New Invoice
            </Link>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              message.error
                ? "bg-red-900/40 border border-red-700 text-red-300"
                : "bg-green-900/40 border border-green-700 text-green-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">No templates yet</p>
            <p className="text-sm mb-6">
              Save an invoice configuration as a template from the invoice creation review step.
            </p>
            <Link
              href="/invoice/new"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
            >
              Create Invoice
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors"
              >
                {editingIndex === i ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameConfirm(); if (e.key === "Escape") setEditingIndex(null); }}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleRenameConfirm}
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-white truncate">{t.name}</h3>
                )}

                <div className="flex flex-col gap-1 text-xs text-gray-400">
                  <span>
                    {t.recipients.length} recipient{t.recipients.length !== 1 ? "s" : ""}
                  </span>
                  <span>{totalAmount(t.recipients).toFixed(2)} USDC total</span>
                  {t.lastUsed && (
                    <span>Last used {timeAgo(t.lastUsed)}</span>
                  )}
                </div>

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => handleUse(i)}
                    className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                  >
                    Use Template
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRenameStart(i)}
                    className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-medium text-gray-300 transition-colors"
                    title="Rename"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(i)}
                    className="px-3 py-2 rounded-lg bg-red-900/50 hover:bg-red-800/70 text-xs font-medium text-red-300 transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
