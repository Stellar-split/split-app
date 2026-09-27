"use client";

import {
  useState,
  useCallback,
  useId,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetId =
  | "total-invoices"
  | "total-volume"
  | "completion-rate"
  | "active-invoices"
  | "overdue-invoices"
  | "pending-payments"
  | "recent-activity"
  | "quick-links";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  description: string;
  size: WidgetSize;
  enabled: boolean;
  order: number;
}

// ─── Widget definitions ───────────────────────────────────────────────────────

const WIDGET_CATALOG: Omit<WidgetConfig, "order" | "enabled">[] = [
  {
    id: "total-invoices",
    label: "Total Invoices",
    description: "Shows the total count of your invoices across all statuses.",
    size: "small",
  },
  {
    id: "total-volume",
    label: "Total Volume",
    description: "Cumulative USDC raised across all released invoices.",
    size: "small",
  },
  {
    id: "completion-rate",
    label: "Completion Rate",
    description: "Percentage of invoices successfully released.",
    size: "small",
  },
  {
    id: "active-invoices",
    label: "Active Invoices",
    description: "Pending invoices whose deadline hasn't passed yet.",
    size: "small",
  },
  {
    id: "overdue-invoices",
    label: "Overdue Invoices",
    description: "Pending invoices that have passed their deadline.",
    size: "medium",
  },
  {
    id: "pending-payments",
    label: "Pending Payments",
    description: "Count of invoices waiting for at least one payment.",
    size: "medium",
  },
  {
    id: "recent-activity",
    label: "Recent Activity Feed",
    description: "Live feed of your latest invoice events and payments.",
    size: "large",
  },
  {
    id: "quick-links",
    label: "Quick Links",
    description: "Shortcut buttons for common actions like creating invoices.",
    size: "medium",
  },
];

const DEFAULT_ENABLED: WidgetId[] = [
  "total-invoices",
  "total-volume",
  "completion-rate",
  "active-invoices",
];

function buildDefaults(): WidgetConfig[] {
  return WIDGET_CATALOG.map((w, i) => ({
    ...w,
    order: i,
    enabled: DEFAULT_ENABLED.includes(w.id),
  }));
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "dashboard-widgets-config";

function loadConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return buildDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaults();
    const parsed = JSON.parse(raw) as WidgetConfig[];
    // Merge with catalog to pick up any new widgets added later
    const ids = new Set(parsed.map((w) => w.id));
    const missing = buildDefaults().filter((w) => !ids.has(w.id));
    return [...parsed, ...missing];
  } catch {
    return buildDefaults();
  }
}

function saveConfig(cfg: WidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage errors (e.g., private browsing quota)
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: "Small (1 col)",
  medium: "Medium (2 cols)",
  large: "Large (full width)",
};

const SIZE_COLORS: Record<WidgetSize, string> = {
  small: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  medium: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  large: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

interface WidgetRowProps {
  widget: WidgetConfig;
  onToggle: (id: WidgetId) => void;
  onSizeChange: (id: WidgetId, size: WidgetSize) => void;
  onMoveUp: (id: WidgetId) => void;
  onMoveDown: (id: WidgetId) => void;
  isFirst: boolean;
  isLast: boolean;
}

function WidgetRow({
  widget,
  onToggle,
  onSizeChange,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: WidgetRowProps) {
  const toggleId = useId();

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border transition-colors ${
        widget.enabled
          ? "bg-gray-900 border-gray-700"
          : "bg-gray-900/40 border-gray-800 opacity-60"
      }`}
    >
      {/* Reorder buttons */}
      <div className="flex sm:flex-col gap-1 shrink-0">
        <button
          onClick={() => onMoveUp(widget.id)}
          disabled={isFirst}
          aria-label={`Move ${widget.label} up`}
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 transition-colors text-xs"
        >
          ↑
        </button>
        <button
          onClick={() => onMoveDown(widget.id)}
          disabled={isLast}
          aria-label={`Move ${widget.label} down`}
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 transition-colors text-xs"
        >
          ↓
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <label
            htmlFor={toggleId}
            className="text-sm font-semibold text-white cursor-pointer"
          >
            {widget.label}
          </label>
          <span
            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SIZE_COLORS[widget.size]}`}
          >
            {SIZE_LABELS[widget.size]}
          </span>
        </div>
        <p className="text-xs text-gray-400">{widget.description}</p>
      </div>

      {/* Size selector */}
      <div className="shrink-0">
        <select
          value={widget.size}
          onChange={(e) =>
            onSizeChange(widget.id, e.target.value as WidgetSize)
          }
          disabled={!widget.enabled}
          aria-label={`Size for ${widget.label}`}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      {/* Toggle */}
      <div className="shrink-0">
        <button
          id={toggleId}
          role="switch"
          aria-checked={widget.enabled}
          onClick={() => onToggle(widget.id)}
          className={`relative inline-flex w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            widget.enabled ? "bg-indigo-600" : "bg-gray-700"
          }`}
          aria-label={`${widget.enabled ? "Disable" : "Enable"} ${widget.label}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              widget.enabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Preview widget ───────────────────────────────────────────────────────────

const SIZE_PREVIEW_COLS: Record<WidgetSize, string> = {
  small: "col-span-1",
  medium: "col-span-2",
  large: "col-span-3",
};

function PreviewWidget({ widget }: { widget: WidgetConfig }) {
  const colSpan = SIZE_PREVIEW_COLS[widget.size];
  const icons: Record<WidgetId, string> = {
    "total-invoices": "📄",
    "total-volume": "💰",
    "completion-rate": "✅",
    "active-invoices": "⚡",
    "overdue-invoices": "⏰",
    "pending-payments": "⏳",
    "recent-activity": "📡",
    "quick-links": "🔗",
  };

  return (
    <div
      className={`${colSpan} bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-1.5 min-h-[80px]`}
    >
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true">{icons[widget.id]}</span>
        <span className="text-xs font-semibold text-gray-300">
          {widget.label}
        </span>
      </div>
      <div className="h-6 bg-gray-700 rounded animate-pulse w-2/3" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface DashboardWidgetsBuilderProps {
  /** Called whenever the config is saved so the dashboard can re-render */
  onConfigChange?: (config: WidgetConfig[]) => void;
}

export default function DashboardWidgetsBuilder({
  onConfigChange,
}: DashboardWidgetsBuilderProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => loadConfig());
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const enabledWidgets = widgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  const handleToggle = useCallback((id: WidgetId) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
    setSaved(false);
  }, []);

  const handleSizeChange = useCallback((id: WidgetId, size: WidgetSize) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
    setSaved(false);
  }, []);

  const handleMoveUp = useCallback((id: WidgetId) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      const swapped = [...sorted];
      [swapped[idx - 1].order, swapped[idx].order] = [
        swapped[idx].order,
        swapped[idx - 1].order,
      ];
      return swapped;
    });
    setSaved(false);
  }, []);

  const handleMoveDown = useCallback((id: WidgetId) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const swapped = [...sorted];
      [swapped[idx].order, swapped[idx + 1].order] = [
        swapped[idx + 1].order,
        swapped[idx].order,
      ];
      return swapped;
    });
    setSaved(false);
  }, []);

  const handleSave = () => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    saveConfig(sorted);
    onConfigChange?.(sorted);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults = buildDefaults();
    setWidgets(defaults);
    saveConfig(defaults);
    onConfigChange?.(defaults);
    setSaved(false);
  };

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Dashboard Widgets</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Choose which widgets appear on your dashboard and arrange them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Reset to default widgets"
          >
            Reset defaults
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
            aria-label="Save widget configuration"
          >
            {saved ? "✓ Saved!" : "Save layout"}
          </button>
        </div>
      </div>

      {/* Widget list */}
      <div
        role="list"
        aria-label="Dashboard widgets configuration"
        className="space-y-2"
      >
        {sortedWidgets.map((widget, idx) => (
          <div key={widget.id} role="listitem">
            <WidgetRow
              widget={widget}
              onToggle={handleToggle}
              onSizeChange={handleSizeChange}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              isFirst={idx === 0}
              isLast={idx === sortedWidgets.length - 1}
            />
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors mb-3"
          aria-expanded={showPreview}
          aria-controls="widget-preview"
        >
          <span
            className={`transition-transform ${showPreview ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            ▶
          </span>
          Preview ({enabledWidgets.length} widget
          {enabledWidgets.length !== 1 ? "s" : ""} enabled)
        </button>

        {showPreview && (
          <div
            id="widget-preview"
            aria-label="Dashboard layout preview"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            {enabledWidgets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No widgets enabled — your dashboard will be empty.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {enabledWidgets.map((widget) => (
                  <PreviewWidget key={widget.id} widget={widget} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enabled count summary */}
      <p className="text-xs text-gray-500 text-right">
        {enabledWidgets.length} of {widgets.length} widgets enabled
      </p>
    </div>
  );
}
