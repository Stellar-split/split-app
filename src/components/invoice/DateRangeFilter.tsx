"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Props {
  from?: string;
  to?: string;
}

export default function DateRangeFilter({ from = "", to = "" }: Props) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [showPicker, setShowPicker] = useState(false);

  const handleFromChange = useCallback(
    (value: string) => {
      setFromDate(value);
      // Ensure end date is not before start date
      if (value && toDate && value > toDate) {
        setToDate(value);
      }
    },
    [toDate]
  );

  const handleToChange = useCallback(
    (value: string) => {
      // Prevent selecting a date before the start date
      if (fromDate && value && value < fromDate) {
        return;
      }
      setToDate(value);
    },
    [fromDate]
  );

  const handleApply = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    router.replace(`?${params.toString()}`, { scroll: false });
    setShowPicker(false);
  }, [fromDate, toDate, router]);

  const handleClear = useCallback(() => {
    setFromDate("");
    setToDate("");
    router.replace("", { scroll: false });
    setShowPicker(false);
  }, [router]);

  const formatDateRange = useCallback(() => {
    if (!fromDate && !toDate) return "Select date range";

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };

    if (fromDate && toDate && fromDate === toDate) {
      return new Date(fromDate).toLocaleDateString(undefined, options);
    }

    let result = "";
    if (fromDate) {
      result += new Date(fromDate).toLocaleDateString(undefined, options);
    }
    if (fromDate && toDate) {
      result += " – ";
    }
    if (toDate) {
      result += new Date(toDate).toLocaleDateString(undefined, options);
    }
    return result;
  }, [fromDate, toDate]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        aria-pressed={showPicker}
        className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm font-medium"
      >
        📅 {formatDateRange()}
      </button>

      {showPicker && (
        <div
          className="absolute top-full left-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-lg z-50 p-4 w-80"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="date-from" className="text-sm font-medium text-gray-300">
                Start Date
              </label>
              <input
                id="date-from"
                type="date"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="date-to" className="text-sm font-medium text-gray-300">
                End Date
              </label>
              <input
                id="date-to"
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => handleToChange(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleApply}
                disabled={!fromDate && !toDate}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {showPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPicker(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
