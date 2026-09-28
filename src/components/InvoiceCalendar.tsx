"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildMonthGrid, dateKey, type CalendarInvoice } from "@/lib/invoiceCalendar";

interface Props {
  invoices: CalendarInvoice[];
  /** Initial month to display; defaults to the current month. */
  initialDate?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-500/20 text-amber-300",
  Funded: "bg-blue-500/20 text-blue-300",
  Released: "bg-emerald-500/20 text-emerald-300",
  Cancelled: "bg-gray-500/20 text-gray-400",
  Expired: "bg-red-500/20 text-red-300",
};

export default function InvoiceCalendar({ invoices, initialDate }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = initialDate ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, invoices),
    [cursor, invoices]
  );
  const todayKey = dateKey(new Date());
  const selectedDay = days.find((d) => d.key === selected);
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shift = (delta: number) => {
    setSelected(null);
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <section aria-label="Invoice deadline calendar" className="bg-gray-900 rounded-xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="px-3 py-1 rounded-md bg-gray-800 hover:bg-gray-700">
          ‹
        </button>
        <h2 className="text-lg font-semibold" aria-live="polite">{title}</h2>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="px-3 py-1 rounded-md bg-gray-800 hover:bg-gray-700">
          ›
        </button>
      </div>

      <div role="grid" className="grid grid-cols-7 gap-1 text-xs sm:text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="text-center text-gray-500 font-medium py-1">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            role="gridcell"
            aria-selected={selected === day.key}
            aria-label={`${day.date.toDateString()}, ${day.invoices.length} invoice${day.invoices.length === 1 ? "" : "s"} due`}
            onClick={() => setSelected(day.key)}
            className={`min-h-12 sm:min-h-20 rounded-md p-1 text-left align-top border ${
              selected === day.key ? "border-indigo-500" : "border-transparent"
            } ${day.inMonth ? "bg-gray-800" : "bg-gray-800/40 text-gray-600"}`}
          >
            <span className={`block text-xs ${day.key === todayKey ? "text-indigo-300 font-bold" : ""}`}>
              {day.date.getDate()}
            </span>
            {day.invoices.length > 0 && (
              <>
                <span className="sm:hidden inline-block mt-1 rounded-full bg-indigo-500 text-white text-[10px] px-1.5">
                  {day.invoices.length}
                </span>
                <ul className="hidden sm:block mt-1 space-y-0.5">
                  {day.invoices.slice(0, 2).map((inv) => (
                    <li key={inv.id} className={`truncate rounded px-1 ${STATUS_COLORS[inv.status] ?? "bg-gray-700"}`}>
                      #{inv.id}
                    </li>
                  ))}
                  {day.invoices.length > 2 && (
                    <li className="text-gray-400">+{day.invoices.length - 2} more</li>
                  )}
                </ul>
              </>
            )}
          </button>
        ))}
      </div>

      {selectedDay && (
        <div className="mt-4" data-testid="calendar-day-detail">
          <h3 className="text-sm font-semibold mb-2">Due {selectedDay.date.toDateString()}</h3>
          {selectedDay.invoices.length === 0 ? (
            <p className="text-sm text-gray-500">No invoices due on this day.</p>
          ) : (
            <ul className="space-y-1">
              {selectedDay.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/invoice/${inv.id}`} className="text-indigo-300 hover:underline">
                    Invoice #{inv.id}
                  </Link>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[inv.status] ?? "bg-gray-700"}`}>
                    {inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
