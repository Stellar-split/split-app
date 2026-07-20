"use client";

import { useMemo } from "react";
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

  const monthGroups = useMemo(() => {
    const groups: Record<string, { year: number; month: number; days: Set<number> }> = {};
    for (const date of upcomingDates) {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[key]) {
        groups[key] = {
          year: date.getFullYear(),
          month: date.getMonth(),
          days: new Set(),
        };
      }
      groups[key].days.add(date.getDate());
    }
    return Object.values(groups);
  }, [upcomingDates]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Upcoming Invoice Dates
      </h3>

      {monthGroups.length === 0 ? (
        <p className="text-sm text-gray-500">No upcoming dates.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthGroups.map((group) => {
            const monthName = new Date(group.year, group.month).toLocaleString(
              "default",
              { month: "long", year: "numeric" }
            );
            const daysInMonth = getDaysInMonth(group.year, group.month);
            const firstDayOfWeek = new Date(
              group.year,
              group.month,
              1
            ).getDay();

            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);

            return (
              <div key={`${group.year}-${group.month}`}>
                <p className="text-xs font-medium text-gray-400 mb-2">
                  {monthName}
                </p>
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
                    const isInvoiceDay = group.days.has(day);
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
