"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface AppNotification {
  id: string;
  type: "payment" | "funded" | "released" | "reminder";
  invoiceId: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "stellarsplit_notifications";

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

/**
 * NotificationCenter — bell icon with unread badge, dropdown of recent events.
 * Notifications are written to localStorage by the polling mechanism.
 */
export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load on mount and listen for storage changes from other tabs/polling
  useEffect(() => {
    setNotifications(loadNotifications());

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setNotifications(loadNotifications());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  };

  const handleClick = (n: AppNotification) => {
    const updated = notifications.map((x) =>
      x.id === n.id ? { ...x, read: true } : x
    );
    saveNotifications(updated);
    setNotifications(updated);
    setOpen(false);
    router.push(`/invoice/${n.invoiceId}`);
  };

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-300"
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
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="min-h-11 px-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Mark all as read
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-800">
              {sorted.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full min-h-11 text-left px-4 py-3 hover:bg-gray-800 transition-colors ${
                      !n.read ? "bg-gray-800/50" : ""
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                      )}
                      <div className={!n.read ? "" : "pl-4"}>
                        <p className="text-sm text-gray-200">{n.message}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(n.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-700 px-4 py-2">
            <button
              onClick={() => { setOpen(false); router.push("/notifications"); }}
              className="w-full min-h-11 text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
