"use client";

import { useState, useEffect, useCallback } from "react";
import { getReminders, type Reminder } from "@/lib/reminders";
import { getSnoozeState, snoozeInvoice, type SnoozeOption } from "@/lib/expirySnooze";

const CHECK_INTERVAL_MS = 60_000;

const SNOOZE_OPTIONS: { option: SnoozeOption; label: string }[] = [
  { option: "1h", label: "1 hour" },
  { option: "24h", label: "24 hours" },
  { option: "3d", label: "3 days" },
];

async function fireNotification(reminder: Reminder) {
  if (!("Notification" in window)) return;
  const show = () =>
    new Notification(`StellarSplit Reminder — Invoice #${reminder.invoiceId}`, {
      body: reminder.message,
      icon: "/favicon.ico",
    });
  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") show();
  }
}

/**
 * ReminderChecker — fires browser notifications for past-due reminders and
 * lets the user snooze any that are currently showing.
 */
export default function ReminderChecker() {
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const checkReminders = useCallback(() => {
    const now = new Date();
    const due = getReminders().filter(
      (r) => new Date(r.reminderDate) <= now && !getSnoozeState(r.invoiceId)
    );
    setDueReminders((prev) => {
      const newlyDue = due.filter((r) => !prev.some((p) => p.invoiceId === r.invoiceId));
      newlyDue.forEach(fireNotification);
      return due;
    });
  }, []);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const handleSnooze = (invoiceId: string, option: SnoozeOption) => {
    snoozeInvoice(invoiceId, option);
    setOpenMenuFor(null);
    setDueReminders((prev) => prev.filter((r) => r.invoiceId !== invoiceId));
  };

  if (dueReminders.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm">
      {dueReminders.map((reminder) => (
        <div
          key={reminder.invoiceId}
          className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg flex items-start justify-between gap-3"
        >
          <div className="text-sm text-gray-200">
            <p className="font-semibold">Invoice #{reminder.invoiceId}</p>
            <p className="text-gray-400">{reminder.message}</p>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() =>
                setOpenMenuFor(openMenuFor === reminder.invoiceId ? null : reminder.invoiceId)
              }
              className="text-xs font-medium px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              Snooze ▼
            </button>
            {openMenuFor === reminder.invoiceId && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-max">
                {SNOOZE_OPTIONS.map(({ option, label }) => (
                  <button
                    key={option}
                    onClick={() => handleSnooze(reminder.invoiceId, option)}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors border-t border-gray-700 first:border-t-0"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
