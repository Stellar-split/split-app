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

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ScheduleStatus = "active" | "paused" | "cancelled";

export interface RecurringSchedule {
  frequency: ScheduleFrequency;
  /** Interval in days; only meaningful when frequency === "custom". */
  intervalDays?: number;
  /** ISO date/time of the first run. */
  startDate: string;
  /** Optional ISO date/time after which no more runs occur. */
  endDate?: string;
  status: ScheduleStatus;
  /** ISO timestamp of the most recent successful run. */
  lastRun?: string;
}

export interface RecurringRun {
  runAt: string;
  status: "scheduled" | "processed" | "failed";
}

export interface UserTemplate {
  name: string;
  recipients: Recipient[];
  token: string;
  createdAt?: string;
  lastUsed?: string;
  versions?: TemplateVersion[];
  schedule?: RecurringSchedule;
  history?: RecurringRun[];
}

const STORAGE_KEY = "invoice_templates";
const MAX_TEMPLATES = 20;
const MAX_VERSIONS = 5;
const MAX_HISTORY = 20;
const MAX_PREVIEW_RUNS = 5;

// ─── Schedule helpers ─────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

/** Advance a date by one schedule interval. */
function addInterval(date: Date, schedule: RecurringSchedule): Date {
  const next = new Date(date);
  switch (schedule.frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "custom":
      next.setDate(next.getDate() + Math.max(1, schedule.intervalDays ?? 1));
      break;
  }
  return next;
}

/** Human-readable one-line summary of a schedule. */
export function describeSchedule(schedule: RecurringSchedule): string {
  const base =
    schedule.frequency === "custom"
      ? `Every ${Math.max(1, schedule.intervalDays ?? 1)} day${(schedule.intervalDays ?? 1) > 1 ? "s" : ""}`
      : FREQUENCY_LABELS[schedule.frequency];
  return `${base} · starts ${new Date(schedule.startDate).toLocaleDateString()}`;
}

/** Compute the next run date for a schedule, or null if none. */
export function getNextRun(schedule: RecurringSchedule, now: Date = new Date()): Date | null {
  if (schedule.status !== "active") return null;
  const end = schedule.endDate ? new Date(schedule.endDate) : null;
  let cursor = schedule.lastRun ? addInterval(new Date(schedule.lastRun), schedule) : new Date(schedule.startDate);
  if (cursor < now) {
    // Fast-forward to the first run at or after now.
    let guard = 0;
    while (cursor < now && guard < 1000) {
      cursor = addInterval(cursor, schedule);
      guard++;
    }
  }
  if (end && cursor > end) return null;
  return cursor;
}

/** Preview the next N run dates for a schedule. */
export function previewRuns(schedule: RecurringSchedule, count = MAX_PREVIEW_RUNS): Date[] {
  const runs: Date[] = [];
  const end = schedule.endDate ? new Date(schedule.endDate) : null;
  let cursor = new Date(schedule.startDate);
  for (let i = 0; i < count; i++) {
    if (end && cursor > end) break;
    runs.push(new Date(cursor));
    cursor = addInterval(cursor, schedule);
  }
  return runs;
}

/**
 * Validate a schedule. Returns an error message, or null when valid.
 * `existing` is used to detect conflicts with other active schedules.
 */
export function validateSchedule(
  schedule: RecurringSchedule,
  existing: UserTemplate[],
  selfName?: string
): string | null {
  const start = new Date(schedule.startDate);
  if (isNaN(start.getTime())) return "Start date is required";
  if (schedule.frequency === "custom") {
    const days = schedule.intervalDays ?? 0;
    if (!Number.isFinite(days) || days < 1) return "Custom interval must be at least 1 day";
    if (days > 365) return "Custom interval cannot exceed 365 days";
  }
  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    if (isNaN(end.getTime())) return "End date is invalid";
    if (end < start) return "End date must be after the start date";
  }
  // Conflict detection: another active schedule with the same frequency and
  // the same start date would fire on the same day.
  const conflict = existing.find(
    (t) =>
      t.name !== selfName &&
      t.schedule &&
      t.schedule.status === "active" &&
      t.schedule.frequency === schedule.frequency &&
      new Date(t.schedule.startDate).toDateString() === start.toDateString()
  );
  if (conflict) {
    return `Schedule conflicts with active template "${conflict.name}" (same frequency and start date)`;
  }
  return null;
}

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

function pushRun(template: UserTemplate, run: RecurringRun): RecurringRun[] {
  const history = template.history ?? [];
  return [run, ...history].slice(0, MAX_HISTORY);
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

// ─── Template preview card ────────────────────────────────────────────────────

/** Truncate a Stellar address to first 6 + last 4 characters. */
function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Read-only preview of a template rendered as an invoice card.
 * Covers all template fields: line items (recipients + amounts), currency,
 * terms (none stored on this model, shown as "—"), and branding label.
 */
function TemplatePreviewCard({ template }: { template: UserTemplate }) {
  const total = template.recipients.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0
  );

  const tokenLabel = template.token
    ? template.token.length > 20
      ? `${template.token.slice(0, 8)}…${template.token.slice(-4)}`
      : template.token
    : "—";

  return (
    <div
      className="rounded-xl border border-indigo-700 bg-gray-900 overflow-hidden text-sm"
      aria-label={`Preview of template "${template.name}"`}
    >
      {/* Header */}
      <div className="bg-indigo-900/50 px-4 py-3 border-b border-indigo-700">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-0.5">
          Template Preview
        </p>
        <h3 className="text-base font-bold text-white truncate">{template.name}</h3>
        {template.lastUsed && (
          <p className="text-xs text-indigo-300/60 mt-0.5">
            Last used: {new Date(template.lastUsed).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Recipients / line items */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
          Recipients
        </p>
        {template.recipients.length === 0 ? (
          <p className="text-gray-500 italic text-xs">No recipients defined.</p>
        ) : (
          <ul className="space-y-1.5">
            {template.recipients.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 bg-gray-800 rounded-lg px-3 py-1.5"
              >
                <span className="font-mono text-xs text-gray-300 truncate max-w-[140px]">
                  {shortAddr(r.address)}
                </span>
                <span className="font-semibold text-indigo-300 text-xs whitespace-nowrap">
                  {r.amount || "—"} {tokenLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary row */}
      <div className="px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-400 border-b border-gray-800">
        <div>
          <span className="text-gray-500">Currency</span>
          <p className="text-gray-200 font-mono mt-0.5">{tokenLabel}</p>
        </div>
        <div>
          <span className="text-gray-500">Total</span>
          <p className="text-indigo-300 font-semibold mt-0.5">
            {total > 0 ? total.toLocaleString() : "—"} {tokenLabel}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Terms</span>
          <p className="text-gray-200 mt-0.5">—</p>
        </div>
        <div>
          <span className="text-gray-500">Recipients</span>
          <p className="text-gray-200 mt-0.5">{template.recipients.length}</p>
        </div>
      </div>

      {/* Recurring schedule summary */}
      {template.schedule && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
            Recurring Schedule
          </p>
          <p className="text-xs text-gray-300">{describeSchedule(template.schedule)}</p>
          <p className="text-xs text-gray-400 mt-1">
            Status:{" "}
            <span
              className={
                template.schedule.status === "active"
                  ? "text-green-400"
                  : template.schedule.status === "paused"
                  ? "text-yellow-400"
                  : "text-red-400"
              }
            >
              {template.schedule.status}
            </span>
          </p>
          {(() => {
            const next = getNextRun(template.schedule);
            return next ? (
              <p className="text-xs text-indigo-300 mt-1">
                Next run: {next.toLocaleString()}
              </p>
            ) : null;
          })()}
        </div>
      )}

      {/* Branding note */}
      <div className="px-4 py-2 bg-gray-900">
        <p className="text-xs text-gray-600">Powered by StellarSplit</p>
      </div>
    </div>
  );
}

// ─── Preview modal ────────────────────────────────────────────────────────────

/**
 * Modal that shows a read-only invoice preview for the selected template.
 * Dismissing returns to the template list; confirming calls onApply.
 */
function TemplatePreviewModal({
  template,
  onApply,
  onDismiss,
}: {
  template: UserTemplate;
  onApply: () => void;
  onDismiss: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview template "${template.name}"`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
    >
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Template Preview</h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close preview"
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preview card */}
        <div className="p-5">
          <TemplatePreviewCard template={template} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="min-h-10 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold text-gray-900 transition-colors"
          >
            Apply Template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TemplateManager ──────────────────────────────────────────────────────────

export default function TemplateManager({ recipients, token, onLoad }: Props) {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  /** Template currently being previewed (before apply). null = no preview open. */
  const [previewTemplate, setPreviewTemplate] = useState<UserTemplate | null>(null);
  /** Index of the template in the preview modal (needed to call loadTemplate). */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  /** Index of the template whose schedule is being edited (null = none). */
  const [scheduleEditIndex, setScheduleEditIndex] = useState<number | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<RecurringSchedule | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  /** Index of the template whose recurring history is being viewed. */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

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

  const handleOpenSaveModal = () => {
    if (templates.length >= MAX_TEMPLATES) {
      flash(`Template limit reached (maximum ${MAX_TEMPLATES} templates)`, true);
      return;
    }
    setSaveName("");
    setSaveError(null);
    setShowSaveModal(true);
  };

  const confirmSaveTemplate = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError("Template name is required");
      return;
    }
    if (templates.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setSaveError("A template with this name already exists");
      return;
    }
    const newTemplate: UserTemplate = {
      name: trimmed,
      recipients,
      token,
      createdAt: new Date().toISOString(),
    };
    persist([...templates, newTemplate]);
    setShowSaveModal(false);
    setSaveName("");
    setSaveError(null);
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

  /** Actually load/apply the template — called after the user confirms in the preview modal. */
  const applyTemplate = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const updated = templates.map((t, i) =>
      i !== index ? t : { ...t, lastUsed: new Date().toISOString() }
    );
    persist(updated);
    onLoad(template);
    flash(`Loaded template: ${template.name}`);
  };

  /** Open the preview modal for a template. */
  const openPreview = (index: number) => {
    const template = templates[index];
    if (!template) return;
    setPreviewTemplate(template);
    setPreviewIndex(index);
  };

  /** Dismiss the preview modal without applying. */
  const dismissPreview = () => {
    setPreviewTemplate(null);
    setPreviewIndex(null);
  };

  /** Confirm applying the previewed template. */
  const confirmApply = () => {
    if (previewIndex !== null) {
      applyTemplate(previewIndex);
    }
    dismissPreview();
  };

  const openScheduleEditor = (index: number) => {
    const template = templates[index];
    if (!template) return;
    const now = new Date();
    now.setSeconds(0, 0);
    setScheduleDraft(
      template.schedule
        ? { ...template.schedule }
        : {
            frequency: "monthly",
            intervalDays: 30,
            startDate: now.toISOString().slice(0, 16),
            status: "active",
          }
    );
    setScheduleError(null);
    setScheduleEditIndex(index);
  };

  const closeScheduleEditor = () => {
    setScheduleEditIndex(null);
    setScheduleDraft(null);
    setScheduleError(null);
  };

  const saveSchedule = () => {
    if (scheduleEditIndex === null || !scheduleDraft) return;
    const template = templates[scheduleEditIndex];
    if (!template) return;
    const error = validateSchedule(scheduleDraft, templates, template.name);
    if (error) {
      setScheduleError(error);
      return;
    }
    persist(
      templates.map((t, i) => (i !== scheduleEditIndex ? t : { ...t, schedule: scheduleDraft }))
    );
    closeScheduleEditor();
    flash("Recurring schedule saved");
  };

  const removeSchedule = (index: number) => {
    persist(templates.map((t, i) => (i !== index ? t : { ...t, schedule: undefined })));
    flash("Recurring schedule removed");
  };

  const setScheduleStatus = (index: number, status: ScheduleStatus) => {
    const template = templates[index];
    if (!template?.schedule) return;
    persist(
      templates.map((t, i) =>
        i !== index || !t.schedule ? t : { ...t, schedule: { ...t.schedule, status } }
      )
    );
    flash(
      status === "active"
        ? "Schedule resumed"
        : status === "paused"
        ? "Schedule paused"
        : "Schedule cancelled"
    );
  };

  /** Simulate processing the next scheduled run for a template. */
  const processNextRun = (index: number) => {
    const template = templates[index];
    if (!template?.schedule) return;
    const next = getNextRun(template.schedule);
    if (!next) {
      flash("No upcoming run for this schedule", true);
      return;
    }
    persist(
      templates.map((t, i) =>
        i !== index || !t.schedule
          ? t
          : {
              ...t,
              lastUsed: next.toISOString(),
              schedule: { ...t.schedule, lastRun: next.toISOString() },
              history: pushRun(t, { runAt: next.toISOString(), status: "processed" }),
            }
      )
    );
    flash(`Processed recurring invoice for ${next.toLocaleDateString()}`);
  };

  const deleteTemplate = (index: number) => {
    setDeleteConfirmIndex(index);
  };

  const confirmDeleteTemplate = (index: number) => {
    persist(templates.filter((_, i) => i !== index));
    setSelectedTemplateIndex(null);
    setShowHistory(false);
    setDeleteConfirmIndex(null);
    if (scheduleEditIndex === index) closeScheduleEditor();
    if (historyIndex === index) setHistoryIndex(null);
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
    <>
      {/* Preview modal (rendered outside the panel box so it overlays the page) */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onApply={confirmApply}
          onDismiss={dismissPreview}
        />
      )}

      {/* Save Template Modal */}
      {showSaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-template-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="w-full max-w-md bg-gray-900 rounded-xl p-5 border border-gray-700 shadow-xl">
            <h3 id="save-template-title" className="text-base font-semibold text-white mb-3">
              Save as Template
            </h3>
            <div className="mb-4">
              <label htmlFor="template-name-input" className="block text-xs font-medium text-gray-400 mb-1">
                Template Name
              </label>
              <input
                id="template-name-input"
                autoFocus
                type="text"
                value={saveName}
                onChange={(e) => {
                  setSaveName(e.target.value);
                  setSaveError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSaveTemplate();
                  if (e.key === "Escape") setShowSaveModal(false);
                }}
                placeholder="e.g. Monthly Payroll"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {saveError && (
                <p className="text-xs text-red-400 mt-1.5" role="alert">
                  {saveError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                  setSaveError(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveTemplate}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Editor Modal */}
      {scheduleEditIndex !== null && scheduleDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="w-full max-w-md bg-gray-900 rounded-xl p-5 border border-gray-700 shadow-xl">
            <h3 id="schedule-editor-title" className="text-base font-semibold text-white mb-1">
              Recurring Schedule
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {templates[scheduleEditIndex]?.name}
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="schedule-frequency" className="block text-xs font-medium text-gray-400 mb-1">
                  Frequency
                </label>
                <select
                  id="schedule-frequency"
                  value={scheduleDraft.frequency}
                  onChange={(e) =>
                    setScheduleDraft({
                      ...scheduleDraft,
                      frequency: e.target.value as ScheduleFrequency,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom interval</option>
                </select>
              </div>

              {scheduleDraft.frequency === "custom" && (
                <div>
                  <label htmlFor="schedule-interval" className="block text-xs font-medium text-gray-400 mb-1">
                    Interval (days)
                  </label>
                  <input
                    id="schedule-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={scheduleDraft.intervalDays ?? 1}
                    onChange={(e) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        intervalDays: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="schedule-start" className="block text-xs font-medium text-gray-400 mb-1">
                  Start date
                </label>
                <input
                  id="schedule-start"
                  type="datetime-local"
                  value={scheduleDraft.startDate.slice(0, 16)}
                  onChange={(e) => setScheduleDraft({ ...scheduleDraft, startDate: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="schedule-end" className="block text-xs font-medium text-gray-400 mb-1">
                  End date (optional)
                </label>
                <input
                  id="schedule-end"
                  type="datetime-local"
                  value={scheduleDraft.endDate?.slice(0, 16) ?? ""}
                  onChange={(e) =>
                    setScheduleDraft({ ...scheduleDraft, endDate: e.target.value || undefined })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Schedule preview */}
              <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
                <p className="text-xs font-medium text-gray-400 mb-1">Upcoming runs</p>
                <ul className="space-y-0.5">
                  {previewRuns(scheduleDraft).map((d, i) => (
                    <li key={i} className="text-xs text-gray-300">
                      {d.toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>

              {scheduleError && (
                <p className="text-xs text-red-400" role="alert">
                  {scheduleError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeScheduleEditor}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring History Modal */}
      {historyIndex !== null && templates[historyIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-history-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="w-full max-w-md bg-gray-900 rounded-xl p-5 border border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 id="recurring-history-title" className="text-base font-semibold text-white">
                Recurring History
              </h3>
              <button
                type="button"
                onClick={() => setHistoryIndex(null)}
                aria-label="Close history"
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">{templates[historyIndex].name}</p>
            {(templates[historyIndex].history?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500 italic">No runs recorded yet.</p>
            ) : (
              <ul className="divide-y divide-gray-700 border border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {(templates[historyIndex].history ?? []).map((run, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-gray-300">{new Date(run.runAt).toLocaleString()}</span>
                    <span
                      className={
                        run.status === "processed"
                          ? "text-green-400"
                          : run.status === "failed"
                          ? "text-red-400"
                          : "text-gray-400"
                      }
                    >
                      {run.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="w-full max-w-sm bg-gray-900 rounded-xl p-5 border border-gray-700 shadow-xl">
            <h3 className="text-base font-semibold text-white mb-2">Delete Template</h3>
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to delete &ldquo;{templates[deleteConfirmIndex]?.name}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmIndex(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-medium text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteTemplate(deleteConfirmIndex)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
            onClick={handleOpenSaveModal}
            className="flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
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
                  {/* Preview button — shows invoice preview before applying */}
                  <button
                    type="button"
                    onClick={() => openPreview(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
                    title="Preview template before applying"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-gray-900 text-sm font-medium transition-colors"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTemplate(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-gray-900 text-sm font-medium transition-colors"
                  >
                    Update
                  </button>
                  {(selectedTemplate?.versions?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHistory((v) => !v)}
                      className="min-h-10 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium transition-colors"
                    >
                      {showHistory ? "Hide History" : "History"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => shareTemplate(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => openScheduleEditor(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
                  >
                    {selectedTemplate?.schedule ? "Edit Schedule" : "Schedule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(selectedTemplateIndex)}
                    className="min-h-10 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Schedule controls for the selected template */}
        {selectedTemplate?.schedule && selectedTemplateIndex !== null && (
          <div className="mb-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-300">{describeSchedule(selectedTemplate.schedule)}</p>
                <p className="text-xs mt-0.5">
                  <span
                    className={
                      selectedTemplate.schedule.status === "active"
                        ? "text-green-400"
                        : selectedTemplate.schedule.status === "paused"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
                  >
                    {selectedTemplate.schedule.status}
                  </span>
                  {(() => {
                    const next = getNextRun(selectedTemplate.schedule);
                    return next ? (
                      <span className="text-gray-400"> · next run {next.toLocaleString()}</span>
                    ) : null;
                  })()}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTemplate.schedule.status === "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setScheduleStatus(selectedTemplateIndex, "paused")}
                      className="px-2.5 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-gray-900 text-xs font-medium transition-colors"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => processNextRun(selectedTemplateIndex)}
                      className="px-2.5 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                    >
                      Process Next
                    </button>
                  </>
                )}
                {selectedTemplate.schedule.status === "paused" && (
                  <button
                    type="button"
                    onClick={() => setScheduleStatus(selectedTemplateIndex, "active")}
                    className="px-2.5 py-1 rounded bg-green-600 hover:bg-green-500 text-gray-900 text-xs font-medium transition-colors"
                  >
                    Resume
                  </button>
                )}
                {selectedTemplate.schedule.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => setScheduleStatus(selectedTemplateIndex, "cancelled")}
                    className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                  >
                    Cancel Schedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHistoryIndex(selectedTemplateIndex)}
                  className="px-2.5 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium transition-colors"
                >
                  History
                </button>
                <button
                  type="button"
                  onClick={() => removeSchedule(selectedTemplateIndex)}
                  className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template list with per-row preview hover */}
        {templates.length > 0 && (
          <ul className="mb-3 divide-y divide-gray-700 border border-gray-700 rounded-lg overflow-hidden">
            {templates.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm bg-gray-900 hover:bg-gray-800/70 transition-colors group"
              >
                <div className="min-w-0">
                  <span className="text-gray-200 truncate block">{t.name}</span>
                  {t.schedule && (
                    <span className="text-xs text-gray-500 truncate block">
                      {describeSchedule(t.schedule)} ·{" "}
                      <span
                        className={
                          t.schedule.status === "active"
                            ? "text-green-400"
                            : t.schedule.status === "paused"
                            ? "text-yellow-400"
                            : "text-red-400"
                        }
                      >
                        {t.schedule.status}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openPreview(i)}
                    className="px-2.5 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
                    aria-label={`Preview template "${t.name}"`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate(i)}
                    className="px-2.5 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                    aria-label={`Apply template "${t.name}"`}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => openScheduleEditor(i)}
                    className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium transition-colors"
                    aria-label={`${t.schedule ? "Edit" : "Add"} schedule for template "${t.name}"`}
                  >
                    {t.schedule ? "Edit Schedule" : "Schedule"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

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
                      <p className="text-gray-400 truncate">{diff}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreVersion(selectedTemplateIndex, vi)}
                      className="shrink-0 px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
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
    </>
  );
}
