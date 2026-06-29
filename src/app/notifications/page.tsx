"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/components/NotificationCenter";

const STORAGE_KEY = "stellarsplit_notifications";

type Tab = "all" | "payments" | "status" | "reminders";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "payments", label: "Payments" },
  { key: "status", label: "Status Changes" },
  { key: "reminders", label: "Reminders" },
];

const TYPE_LABELS: Record<AppNotification["type"], string> = {
  payment: "Payment",
  funded: "Funded",
  released: "Released",
  reminder: "Reminder",
  expired: "Expired",
};

const TYPE_COLORS: Record<AppNotification["type"], string> = {
  payment: "bg-indigo-500/20 text-indigo-300",
  funded: "bg-yellow-500/20 text-yellow-300",
  released: "bg-green-500/20 text-green-300",
  reminder: "bg-purple-500/20 text-purple-300",
  expired: "bg-red-500/20 text-red-300",
};

function load(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function save(ns: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ns));
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const router = useRouter();

  useEffect(() => {
    setNotifications(load());
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setNotifications(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (ns: AppNotification[]) => { save(ns); setNotifications(ns); };

  const markRead = (id: string) =>
    update(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const deleteAll = () => update([]);

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    router.push(`/invoice/${n.invoiceId}`);
  };

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  const filtered = sorted.filter((n) => {
    if (tab === "payments") return n.type === "payment";
    if (tab === "status") return n.type === "funded" || n.type === "released";
    if (tab === "reminders") return n.type === "reminder";
    return true;
  });

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {notifications.length > 0 && (
          <button
            onClick={deleteAll}
            className="min-h-11 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold transition-colors"
          >
            Delete all
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-11 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16 text-sm">No notifications here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((n) => (
            <li key={n.id} className={`rounded-xl border ${n.read ? "border-gray-800 bg-gray-900" : "border-indigo-800/50 bg-indigo-950/30"}`}>
              <div className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 text-xs px-2 py-1 rounded-full font-semibold shrink-0 ${TYPE_COLORS[n.type]}`}>
                  {TYPE_LABELS[n.type]}
                </span>
                <button
                  onClick={() => handleClick(n)}
                  className="flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                >
                  <p className={`text-sm ${n.read ? "text-gray-300" : "text-gray-100 font-medium"}`}>{n.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(n.timestamp).toLocaleString()}</p>
                </button>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    aria-label="Mark as read"
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-indigo-400 transition-colors shrink-0"
                  >
                    ✓
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
