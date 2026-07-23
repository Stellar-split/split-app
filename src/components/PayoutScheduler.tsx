"use client";

import { useEffect, useState } from "react";

interface Props {
  invoiceId: string;
  vestingCliff: number;
  publicKey: string | null;
}

const STORAGE_KEY = "stellarsplit_payout_schedules";

interface Schedule {
  invoiceId: string;
  date: string;
}

function loadSchedules(): Schedule[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveSchedule(invoiceId: string, date: string) {
  const schedules = loadSchedules().filter((s) => s.invoiceId !== invoiceId);
  schedules.push({ invoiceId, date });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

function clearSchedule(invoiceId: string) {
  const schedules = loadSchedules().filter((s) => s.invoiceId !== invoiceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export default function PayoutScheduler({ invoiceId, vestingCliff, publicKey }: Props) {
  const [date, setDate] = useState("");
  const [saved, setSaved] = useState(false);

  const cliffPassed = Math.floor(Date.now() / 1000) >= vestingCliff;

  useEffect(() => {
    const existing = loadSchedules().find((s) => s.invoiceId === invoiceId);
    if (existing) { setDate(existing.date); setSaved(true); }
  }, [invoiceId]);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    saveSchedule(invoiceId, date);
    setSaved(true);

    if ("Notification" in window && Notification.permission === "granted") {
      const msUntil = new Date(date).getTime() - Date.now();
      if (msUntil > 0) {
        setTimeout(() => {
          new Notification(`StellarSplit — Payout ready for Invoice #${invoiceId}`, {
            body: "Your vesting cliff has passed. Claim your share now.",
            icon: "/favicon.ico",
          });
        }, msUntil);
      }
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const handleCancel = () => {
    clearSchedule(invoiceId);
    setDate("");
    setSaved(false);
  };

  return (
    <section className="mt-4 p-4 rounded-xl border border-gray-700 bg-gray-900">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Payout Scheduler</h3>

      {cliffPassed ? (
        <p className="text-green-400 text-sm mb-3">Vesting cliff passed — you can claim now.</p>
      ) : (
        <p className="text-sm text-gray-400 mb-3">
          Cliff on {new Date(vestingCliff * 1000).toLocaleDateString()}. Schedule a reminder.
        </p>
      )}

      {!saved ? (
        <form onSubmit={handleSchedule} className="flex flex-col sm:flex-row gap-2">
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            required
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            type="submit"
            className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Schedule
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-300">
            Scheduled: <span className="text-indigo-300">{new Date(date).toLocaleString()}</span>
          </p>
          <button
            onClick={handleCancel}
            className="min-h-11 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {publicKey && cliffPassed && (
        <p className="mt-3 text-xs text-gray-400">
          Go to the invoice page to claim your share.
        </p>
      )}
    </section>
  );
}
