"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info" | "loading" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Optional deduplication key; toasts sharing a key are collapsed. */
  dedupeKey?: string;
  /** Optional action buttons (e.g. Retry / Discard). */
  actions?: ToastAction[];
  /** When true the toast will not auto-dismiss. */
  persistent?: boolean;
}

export interface ToastOptions {
  dedupeKey?: string;
  actions?: ToastAction[];
  persistent?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (message: string, options?: ToastOptions) => string;
    error: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
    loading: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    /** Upgrade an existing loading toast to success or error */
    update: (
      id: string,
      message: string,
      type: Exclude<ToastType, "loading">,
      options?: ToastOptions
    ) => void;
    dismiss: (id: string) => void;
    /** Show a retry notification with a live countdown and optional cancel. */
    retry: (message: string, options?: RetryToastOptions) => string;
    /** Update the countdown text of an existing retry toast. */
    retryCountdown: (id: string, secondsRemaining: number) => void;
    /** Show a queue status notification with optional actions. */
    queue: (message: string, options?: ToastOptions) => string;
  };
}

export interface RetryToastOptions extends ToastOptions {
  /** Attempt number (1-based) for display, e.g. "Retry 2 of 5". */
  attempt?: number;
  maxAttempts?: number;
  /** Seconds until the next retry; enables a live countdown. */
  secondsRemaining?: number;
  onCancel?: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4000;
const RETRY_TOAST_DISMISS_MS = 8000;
const QUEUE_TOAST_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  toastsRef.current = toasts;
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: string, durationMs: number = AUTO_DISMISS_MS) => {
      clearTimeout(timers.current.get(id));
      const timer = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const add = useCallback(
    (message: string, type: ToastType, options: ToastOptions = {}): string => {
      const { dedupeKey, actions, persistent } = options;

      // Deduplicate: if a toast with the same key exists, update it in place.
      if (dedupeKey) {
        const existing = toastsRef.current.find((t) => t.dedupeKey === dedupeKey);
        if (existing) {
          setToasts((prev) =>
            prev.map((t) =>
              t.id === existing.id
                ? { ...t, message, type, actions, persistent }
                : t
            )
          );
          if (type !== "loading" && !persistent) scheduleAutoDismiss(existing.id);
          else clearTimeout(timers.current.get(existing.id));
          return existing.id;
        }
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        const next = [
          ...prev,
          { id, message, type, dedupeKey, actions, persistent },
        ];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      if (type !== "loading" && !persistent) scheduleAutoDismiss(id);
      return id;
    },
    [scheduleAutoDismiss]
  );

  const update = useCallback(
    (
      id: string,
      message: string,
      type: Exclude<ToastType, "loading">,
      options: ToastOptions = {}
    ) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                message,
                type,
                actions: options.actions ?? t.actions,
                persistent: options.persistent ?? t.persistent,
              }
            : t
        )
      );
      if (options.persistent) clearTimeout(timers.current.get(id));
      else scheduleAutoDismiss(id);
    },
    [scheduleAutoDismiss]
  );

  const retry = useCallback(
    (message: string, options: RetryToastOptions = {}): string => {
      const { attempt, maxAttempts, secondsRemaining, onCancel, ...rest } = options;
      const parts: string[] = [message];
      if (attempt != null && maxAttempts != null) {
        parts.push(`(attempt ${attempt} of ${maxAttempts})`);
      }
      if (secondsRemaining != null) {
        parts.push(`Retrying in ${secondsRemaining}s…`);
      }
      const actions: ToastAction[] = [...(rest.actions ?? [])];
      if (onCancel) actions.push({ label: "Cancel", onClick: onCancel });
      return add(parts.join(" "), "warning", {
        ...rest,
        actions: actions.length > 0 ? actions : undefined,
        persistent: rest.persistent ?? true,
      });
    },
    [add]
  );

  const retryCountdown = useCallback(
    (id: string, secondsRemaining: number) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const base = t.message.replace(/\s*Retrying in \d+s…$/, "");
          return { ...t, message: `${base} Retrying in ${secondsRemaining}s…` };
        })
      );
    },
    []
  );

  const queue = useCallback(
    (message: string, options: ToastOptions = {}): string =>
      add(message, "info", {
        ...options,
        persistent: options.persistent ?? false,
      }),
    [add]
  );

  const toast = {
    success: (message: string, options?: ToastOptions) => add(message, "success", options),
    error: (message: string, options?: ToastOptions) => add(message, "error", options),
    info: (message: string, options?: ToastOptions) => add(message, "info", options),
    loading: (message: string, options?: ToastOptions) => add(message, "loading", options),
    warning: (message: string, options?: ToastOptions) => add(message, "warning", options),
    update,
    dismiss,
    retry,
    retryCountdown,
    queue,
  };

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue["toast"] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}

// ── Toast container UI ────────────────────────────────────────────────────────

const TYPE_STYLES: Record<ToastType, string> = {
  success: "bg-green-800 text-green-100 border-green-700",
  error: "bg-red-800 text-red-100 border-red-700",
  info: "bg-indigo-800 text-indigo-100 border-indigo-700",
  loading: "bg-gray-800 text-gray-100 border-gray-700",
  warning: "bg-amber-800 text-amber-100 border-amber-700",
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  loading: "⟳",
  warning: "↻",
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm pointer-events-auto ${TYPE_STYLES[t.type]}`}
          role="alert"
        >
          <span
            className={`mt-0.5 shrink-0 ${t.type === "loading" ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            {TYPE_ICONS[t.type]}
          </span>
          <span className="flex-1 break-words">{t.message}</span>
          {t.actions && t.actions.length > 0 && (
            <span className="flex shrink-0 items-center gap-2">
              {t.actions.map((action, i) => (
                <button
                  key={`${t.id}-action-${i}`}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    onDismiss(t.id);
                  }}
                  className="shrink-0 underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
                >
                  {action.label}
                </button>
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
