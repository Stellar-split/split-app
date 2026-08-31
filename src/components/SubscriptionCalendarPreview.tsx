"use client";

import { useMemo, useState } from "react";
import { computeUpcomingDates } from "@/lib/subscriptions";

interface Props {
  intervalDays: number;
  count?: number;
  fromDate?: Date;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function SubscriptionCalendarPreview({
  intervalDays,
  count = 6,
  fromDate,
}: Props) {
  const upcomingDates = useMemo(
    () => computeUpcomingDates(intervalDays, count, fromDate),
    [intervalDays, count, fromDate]
  );

  const initialView = useMemo(() => {
    const first = upcomingDates[0] ?? fromDate ?? new Date();
    return { year: first.getFullYear(), month: first.getMonth() };
  }, [upcomingDates, fromDate]);

  const [viewOffset, setViewOffset] = useState(0);

  const viewDate = useMemo(() => {
    return new Date(initialView.year, initialView.month + viewOffset, 1);
  }, [initialView, viewOffset]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const invoiceDaysInView = useMemo(() => {
    const days = new Set<number>();
    for (const date of upcomingDates) {
      if (date.getFullYear() === viewYear && date.getMonth() === viewMonth) {
        days.add(date.getDate());
      }
    }
    return days;
  }, [upcomingDates, viewYear, viewMonth]);

  const monthName = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Upcoming Invoice Dates
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewOffset((o) => o - 1)}
            className="text-gray-400 hover:text-white px-1"
          >
            ←
          </button>
          <span className="text-xs font-medium text-gray-300 min-w-[7rem] text-center">
            {monthName}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewOffset((o) => o + 1)}
            className="text-gray-400 hover:text-white px-1"
          >
            →
          </button>
        </div>
      </div>

      {upcomingDates.length === 0 ? (
        <p className="text-sm text-gray-500">No upcoming dates.</p>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] text-gray-600 pb-0.5"
            >
              {label.charAt(0)}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} />;
            }
            const isInvoiceDay = invoiceDaysInView.has(day);
            return (
              <div
                key={day}
                className={`text-center text-xs py-1 rounded ${
                  isInvoiceDay
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-gray-500"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-indigo-600" />
          Invoice date
        </div>
        <div>Next {count} dates shown</div>
      </div>
    </div>
  );
}
