"use client";

import { useState, useEffect, useRef } from "react";
import { encodeTemplate } from "@/lib/templateSharing";

interface Recipient {
  address: string;
  amount: string;
}

interface TemplateVersion {
  recipients: Recipient[];
  token: string;
  savedAt: string;
}

export interface UserTemplate {
  name: string;
  recipients: Recipient[];
  token: string;
  lastUsed?: string;
  versions?: TemplateVersion[];
}

const STORAGE_KEY = "invoice_templates";
const MAX_TEMPLATES = 20;
const MAX_VERSIONS = 5;

interface Props {
  recipients: Recipient[];
  token: string;
  onLoad: (template: UserTemplate) => void;
}

function describeVersionDiff(prev: TemplateVersion, curr: TemplateVersion): string {
  const prevAddresses = new Set(prev.recipients.map((r) => r.address));
  const currAddresses = new Set(curr.recipients.map((r) => r.address));
  const added = curr.recipients.filter((r) => !prevAddresses.has(r.address));
  const removed = prev.recipients.filter((r) => !currAddresses.has(r.address));
  const changed = curr.recipients.filter((r) => {
    const old = prev.recipients.find((p) => p.address === r.address);
    return old && old.amount !== r.amount;
  });
  const parts: string[] = [];
  if (added.length > 0) parts.push(`+${added.length} recipient${added.length > 1 ? "s" : ""}`);
  if (removed.length > 0) parts.push(`-${removed.length} recipient${removed.length > 1 ? "s" : ""}`);
  if (changed.length > 0) parts.push(`${changed.length} amount${changed.length > 1 ? "s" : ""} changed`);
  if (curr.token !== prev.token) parts.push(`token → ${curr.token}`);
  return parts.length > 0 ? parts.join(", ") : "no changes";
}

function pushVersion(template: UserTemplate, version: TemplateVersion): TemplateVersion[] {
  const history = template.versions ?? [];
  const updated = [version, ...history].slice(0, MAX_VERSIONS);
  return updated;
}

export function loadTemplates(): UserTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: UserTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export default function TemplateManager({ recipients, token, onLoad }: Props) {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const flash = (msg: string, error = false) => {
    setMessage(msg);
    setIsError(error);
    setTimeout(() => setMessage(null), 2500);
  };

  const persist = (updated: UserTemplate[]) => {
    saveTemplates(updated);
    setTemplates(updated);
  };

  const saveTemplate = () => {
    if (templates.length >= MAX_TEMPLATES) {
      flash(`Template limit reached (maximum ${MAX_TEMPLATES} templates)`, true);
      return;
    }
    const templateName = prompt("Enter template name:");
    if (!templateName) return;
    const newTemplate: UserTemplate = { name: templateName, recipients, token };
    persist([...templates, newTemplate]);
    flash("Template saved successfully");
  };

  const updateTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const prevVersion: TemplateVersion = {
      recipients: template.recipients,
      token: template.token,
      savedAt: new Date().toISOString(),
    };
    persist(
      templates.map((t, i) =>
        i !== index ? t : { ...t, recipients, token, versions: pushVersion(t, prevVersion) }
      )
    );
    flash("Template updated");
  };

  const restoreVersion = (templateIndex: number, versionIndex: number) => {
    const template = templates[templateIndex];
    if (!template) return;
    const version = template.versions?.[versionIndex];
    if (!version) return;
    const currentAsVersion: TemplateVersion = {
      recipients: template.recipients,
      token: template.token,
      savedAt: new Date().toISOString(),
    };
    const updated = templates.map((t, i) =>
      i !== templateIndex
        ? t
        : { ...t, recipients: version.recipients, token: version.token, versions: pushVersion(t, currentAsVersion) }
    );
    persist(updated);
    onLoad({ name: template.name, recipients: version.recipients, token: version.token });
    setShowHistory(false);
    flash(`Restored version from ${new Date(version.savedAt).toLocaleString()}`);
  };

  const loadTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const updated = templates.map((t, i) =>
      i !== index ? t : { ...t, lastUsed: new Date().toISOString() }
    );
    persist(updated);
    onLoad(template);
    flash(`Loaded template: ${template.name}`);
  };

  const deleteTemplate = (index: number) => {
    persist(templates.filter((_, i) => i !== index));
    setSelectedTemplateIndex(null);
    setShowHistory(false);
    flash("Template deleted");
  };

  const shareTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    try {
      const encoded = encodeTemplate({ recipients: template.recipients, token: template.token });
      const url = `${window.location.origin}/invoice/new?template=${encoded}`;
      navigator.clipboard.writeText(url);
      flash("Shareable link copied to clipboard!");
    } catch {
      flash("Error generating shareable link", true);
    }
  };

  const exportTemplates = () => {
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

  const importTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: UserTemplate[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error("Invalid format");
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

  const selectedTemplate =
    selectedTemplateIndex !== null ? templates[selectedTemplateIndex] : null;

  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-300">Invoice Templates</h2>
        <div className="flex gap-1">
          {templates.length > 0 && (
            <button
              type="button"
              onClick={exportTemplates}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
              title="Export templates as JSON"
            >
              Export
            </button>
          )}
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
            title="Import templates from JSON"
          >
            Import
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importTemplates} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <button
          type="button"
          onClick={saveTemplate}
          className="flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
        >
          Save as Template
        </button>

        {templates.length > 0 && (
          <div className="flex-1 flex gap-2 flex-wrap">
            <select
              value={selectedTemplateIndex ?? ""}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setSelectedTemplateIndex(isNaN(idx) ? null : idx);
                setShowHistory(false);
              }}
              className="flex-1 min-h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select template…</option>
              {templates.map((t, i) => (
                <option key={i} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplateIndex !== null && (
              <>
                <button
                  type="button"
                  onClick={() => loadTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition-colors"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => updateTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-sm font-medium transition-colors"
                >
                  Update
                </button>
                {(selectedTemplate?.versions?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-sm font-medium transition-colors"
                  >
                    {showHistory ? "Hide History" : "History"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => shareTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showHistory && selectedTemplate && selectedTemplateIndex !== null && (
        <div className="mt-3 border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-900 px-4 py-2 text-xs font-medium text-gray-400">
            Version history (newest first, up to {MAX_VERSIONS})
          </div>
          <ul className="divide-y divide-gray-700">
            {(selectedTemplate.versions ?? []).map((v, vi) => {
              const prev = selectedTemplate.versions?.[vi + 1] ?? {
                recipients: [],
                token: selectedTemplate.token,
                savedAt: "",
              };
              const diff =
                vi < (selectedTemplate.versions?.length ?? 0) - 1
                  ? describeVersionDiff(prev, v)
                  : "initial version";
              return (
                <li key={vi} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="text-gray-300">{new Date(v.savedAt).toLocaleString()}</p>
                    <p className="text-gray-500 truncate">{diff}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreVersion(selectedTemplateIndex, vi)}
                    className="shrink-0 px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-xs font-medium transition-colors"
                  >
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {message && (
        <p className={`text-sm mt-2 ${isError ? "text-red-400" : "text-green-400"}`}>{message}</p>
      )}
    </div>
  );
}
