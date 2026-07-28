"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";

export type NotificationType = "payment" | "funded" | "released" | "expired" | "reminder";

export interface AppNotification {
  id: string;
  type: NotificationType;
  invoiceId: string;
  invoiceTitle: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "stellarsplit_notifications_v2";
const SUBSCRIBED_KEY = "stellarsplit_notify_invoices";
const MAX_NOTIFICATIONS = 50;
const POLL_INTERVAL_MS = 30_000;

function loadNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

function getSubscribedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBSCRIBED_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function absoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

const TYPE_ICONS: Record<NotificationType, string> = {
  payment: "💳",
  funded: "✅",
  released: "🚀",
  expired: "⏰",
  reminder: "📅",
};

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  const syncFromStorage = useCallback(() => {
    setNotifications(loadNotifications());
  }, []);

  // Load on mount and listen for storage changes
  useEffect(() => {
    syncFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) syncFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncFromStorage]);

  // Poll subscribed invoices every 30 seconds
  useEffect(() => {
    const poll = async () => {
      const ids = getSubscribedIds();
      if (ids.length === 0) return;
      const existing = loadNotifications();
      const newItems: AppNotification[] = [];

      for (const invoiceId of ids) {
        try {
          const inv = await splitClient.getInvoice(invoiceId);
          const total = inv.recipients.reduce((s: bigint, r: { amount: bigint }) => s + r.amount, 0n);
          const title = (inv as any).title ?? `Invoice #${invoiceId}`;
          const now = Math.floor(Date.now() / 1000);

          // Payment received
          if (inv.funded > 0n) {
            const key = `payment-${invoiceId}-${inv.funded.toString()}`;
            if (!existing.some((n) => n.id === key)) {
              newItems.push({
                id: key,
                type: "payment",
                invoiceId,
                invoiceTitle: title,
                message: `Payment received on ${title}`,
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          // Fully funded
          if (total > 0n && inv.funded >= total) {
            const key = `funded-${invoiceId}`;
            if (!existing.some((n) => n.id === key)) {
              newItems.push({
                id: key,
                type: "funded",
                invoiceId,
                invoiceTitle: title,
                message: `Invoice fully funded: ${title}`,
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          // Released
          if (inv.status === "Released") {
            const key = `released-${invoiceId}`;
            if (!existing.some((n) => n.id === key)) {
              newItems.push({
                id: key,
                type: "released",
                invoiceId,
                invoiceTitle: title,
                message: `Funds released for ${title}`,
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          // Expired
          if (inv.status === "Pending" && inv.deadline <= now) {
            const key = `expired-${invoiceId}`;
            if (!existing.some((n) => n.id === key)) {
              newItems.push({
                id: key,
                type: "expired",
                invoiceId,
                invoiceTitle: title,
                message: `Invoice expired: ${title}`,
                timestamp: Date.now(),
                read: false,
              });
            }
          }
        } catch {
          // skip unavailable invoices
        }
      }

      if (newItems.length > 0) {
        const merged = [...newItems, ...existing].slice(0, MAX_NOTIFICATIONS);
        saveNotifications(merged);
        setNotifications(merged);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard: Escape closes, focus management
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus first item when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => firstItemRef.current?.focus(), 50);
    }
  }, [open]);

  const unread = notifications.filter((n) => !n.read).length;
  const badgeCount = unread > 99 ? "99+" : unread > 0 ? String(unread) : null;

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  };

  const markRead = (id: string) => {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);
  };

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {badgeCount && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-0.5 text-[10px] font-bold text-white leading-none">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-surface-900 border border-white/[0.08] rounded-xl shadow-xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="font-semibold text-sm text-white">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 px-1"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-400 text-center">No notifications yet.</p>
          ) : (
            <ul
              className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]"
              role="list"
            >
              {sorted.map((n, idx) => (
                <li key={n.id} role="listitem">
                  <Link
                    href={`/invoice/${n.invoiceId}`}
                    ref={idx === 0 ? firstItemRef : undefined}
                    onClick={() => { markRead(n.id); setOpen(false); }}
                    className={`flex items-start gap-3 w-full px-4 py-3 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
                      !n.read ? "bg-brand-600/10" : ""
                    }`}
                    tabIndex={0}
                  >
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0" aria-hidden="true">
                      {TYPE_ICONS[n.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-snug">{n.message}</p>
                      <p
                        className="text-xs text-slate-500 mt-0.5"
                        title={absoluteTime(n.timestamp)}
                      >
                        {relativeTime(n.timestamp)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block w-full text-xs text-brand-400 hover:text-brand-300 transition-colors text-center py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
