"use client";

import { useMemo, useState } from "react";
import {
  computeUpcomingDates,
  type RecurringSchedule,
  type ScheduleStatus,
} from "@/lib/subscriptions";

interface Props {
  schedule: RecurringSchedule;
  count?: number;
  fromDate?: Date;
  status?: ScheduleStatus;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function SubscriptionCalendarPreview({
  schedule,
  count = 6,
  fromDate,
  status = "active",
}: Props) {
  const upcomingDates = useMemo(
    () => computeUpcomingDates(schedule, count, fromDate),
    [schedule, count, fromDate]
  );

  const isInactive = status === "paused" || status === "cancelled";

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
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">
            Upcoming Invoice Dates
          </h3>
          {status !== "active" && (
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                status === "paused"
                  ? "bg-yellow-900/50 text-yellow-300"
                  : "bg-red-900/50 text-red-300"
              }`}
            >
              {status}
            </span>
          )}
        </div>
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
        <p className="text-sm text-gray-500">
          {isInactive
            ? "No upcoming dates while this schedule is inactive."
            : "No upcoming dates."}
        </p>
      ) : (
        <div
          className={`grid grid-cols-7 gap-0.5 ${
            isInactive ? "opacity-50" : ""
          }`}
        >
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
          <span
            className={`w-3 h-3 rounded ${
              isInactive ? "bg-gray-600" : "bg-indigo-600"
            }`}
          />
          Invoice date
        </div>
        <div>Next {count} dates shown</div>
      </div>
    </div>
  );
}
