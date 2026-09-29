"use client";

import { useMemo } from "react";
import { computeGamification, type PaymentEvent } from "@/lib/paymentGamification";

export default function PaymentGamificationPanel({ events }: { events: PaymentEvent[] }) {
  const summary = useMemo(() => computeGamification(events), [events]);
  const percent = Math.round(summary.levelProgress * 100);

  return (
    <section className="space-y-4 rounded border p-4" aria-label="Payment rewards">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Level {summary.level.level}: {summary.level.name}
        </h2>
        <span className="tabular-nums">{summary.points} points</span>
      </div>

      <div>
        <div
          role="progressbar"
          aria-label="Progress to next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded bg-gray-200"
        >
          <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {summary.nextLevel
            ? `${summary.nextLevel.minPoints - summary.points} points to ${summary.nextLevel.name}`
            : "Top level reached"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Payments</dt>
          <dd className="font-semibold tabular-nums">{summary.paymentCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Day streak</dt>
          <dd className="font-semibold tabular-nums">{summary.streakDays}</dd>
        </div>
      </dl>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Badges">
        {summary.badges.map((b) => (
          <li
            key={b.id}
            data-earned={b.earned}
            className={`rounded border p-2 text-sm ${b.earned ? "" : "opacity-50"}`}
          >
            <span className="font-medium">{b.label}</span>
            <span className="block text-xs text-gray-500">{b.description}</span>
            <span className="sr-only">{b.earned ? "Earned" : "Locked"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
