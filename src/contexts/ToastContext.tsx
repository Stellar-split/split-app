"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (message: string) => string;
    error: (message: string) => string;
    info: (message: string) => string;
    loading: (message: string) => string;
    /** Upgrade an existing loading toast to success or error */
    update: (id: string, message: string, type: Exclude<ToastType, "loading">) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: string) => {
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const add = useCallback(
    (message: string, type: ToastType): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        const next = [...prev, { id, message, type }];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      if (type !== "loading") scheduleAutoDismiss(id);
      return id;
    },
    [scheduleAutoDismiss]
  );

  const update = useCallback(
    (id: string, message: string, type: Exclude<ToastType, "loading">) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, message, type } : t))
      );
      scheduleAutoDismiss(id);
    },
    [scheduleAutoDismiss]
  );

  const toast = {
    success: (message: string) => add(message, "success"),
    error: (message: string) => add(message, "error"),
    info: (message: string) => add(message, "info"),
    loading: (message: string) => add(message, "loading"),
    update,
    dismiss,
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
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  loading: "⟳",
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
