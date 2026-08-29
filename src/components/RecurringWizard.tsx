"use client";

import { useMemo, useState } from "react";

interface RecurringConfig {
  enabled: boolean;
  intervalDays: 7 | 30;
  endDate?: string;
  maxOccurrences?: number;
}

interface Props {
  onConfirm: (config: RecurringConfig) => void;
}

// --- #616: mini calendar helpers ---

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Compute the next `count` payment dates starting from `startDate`, spaced by
 * `intervalDays` days, stopping at `endDate` if provided.
 */
function computeSchedule(
  intervalDays: number,
  startDate: Date,
  endDate: Date | null,
  count: number
): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);
  while (dates.length < count) {
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    if (endDate && current > endDate) break;
    dates.push(new Date(current));
  }
  return dates;
}

/**
 * MiniCalendar — renders a single month calendar with highlighted payment dates.
 */
interface MiniCalendarProps {
  year: number;
  month: number; // 0-indexed
  highlightedDays: Set<number>;
}

function MiniCalendar({ year, month, highlightedDays }: MiniCalendarProps) {
  const monthName = new Date(year, month).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 min-w-[168px]">
      <p className="text-xs font-semibold text-gray-300 mb-2 text-center">{monthName}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[9px] text-gray-600 pb-0.5 font-medium"
          >
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const isHighlighted = highlightedDays.has(day);
          return (
            <div
              key={day}
              className={`text-center text-[11px] py-1 rounded transition-colors ${
                isHighlighted
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-gray-500"
              }`}
              aria-label={
                isHighlighted
                  ? `Payment scheduled on ${monthName} ${day}`
                  : undefined
              }
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ScheduleCalendarPreview — renders a grid of mini calendars for the next 6
 * scheduled payment dates.
 *
 * Re-renders automatically when intervalDays, startDate, or endDate change.
 */
interface ScheduleCalendarPreviewProps {
  intervalDays: 7 | 30;
  endDate: string; // ISO date string or ""
  useMaxOccurrences: boolean;
  maxOccurrences: string;
}

function ScheduleCalendarPreview({
  intervalDays,
  endDate,
  useMaxOccurrences,
  maxOccurrences,
}: ScheduleCalendarPreviewProps) {
  const scheduleDates = useMemo(() => {
    const startDate = new Date();
    const resolvedEndDate =
      !useMaxOccurrences && endDate ? new Date(endDate) : null;
    const limit = useMaxOccurrences
      ? Math.min(parseInt(maxOccurrences) || 6, 6)
      : 6;
    return computeSchedule(intervalDays, startDate, resolvedEndDate, limit);
  }, [intervalDays, endDate, useMaxOccurrences, maxOccurrences]);

  // Group dates by year-month
  const monthGroups = useMemo(() => {
    const groups: Map<string, { year: number; month: number; days: Set<number> }> =
      new Map();
    for (const date of scheduleDates) {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          year: date.getFullYear(),
          month: date.getMonth(),
          days: new Set(),
        });
      }
      groups.get(key)!.days.add(date.getDate());
    }
    return Array.from(groups.values());
  }, [scheduleDates]);

  return (
    <div
      className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4"
      aria-label="Upcoming payment dates calendar"
    >
      <p className="text-xs font-semibold text-gray-400 mb-3">
        Next {scheduleDates.length} payment date{scheduleDates.length !== 1 ? "s" : ""}
      </p>

      {scheduleDates.length === 0 ? (
        <p className="text-xs text-gray-500">
          No upcoming dates — adjust your end date or occurrences.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {monthGroups.map((group) => (
              <MiniCalendar
                key={`${group.year}-${group.month}`}
                year={group.year}
                month={group.month}
                highlightedDays={group.days}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
            <span>Scheduled payment date</span>
          </div>
        </>
      )}
    </div>
  );
}
// --- end #616 ---

export default function RecurringWizard({ onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [intervalDays, setIntervalDays] = useState<7 | 30>(7);
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [useMaxOccurrences, setUseMaxOccurrences] = useState(false);

  const generatePreviewDates = () => {
    const dates = [];
    let current = new Date();
    const limit = useMaxOccurrences ? parseInt(maxOccurrences) : 12;

    for (let i = 0; i < limit; i++) {
      current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      if (endDate && current > new Date(endDate)) break;
      dates.push(current.toISOString().split("T")[0]);
    }
    return dates;
  };

  const previewDates = step === 3 ? generatePreviewDates() : [];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = () => {
    onConfirm({
      enabled: true,
      intervalDays,
      ...(useMaxOccurrences && { maxOccurrences: parseInt(maxOccurrences) }),
      ...(!useMaxOccurrences && endDate && { endDate }),
    });
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-6">Recurring Invoice Setup</h3>

      {/* Step 1: Interval Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 1 of 3: Select interval</p>
          <div className="space-y-3">
            {[
              { value: 7, label: "Weekly" },
              { value: 30, label: "Monthly" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntervalDays(option.value as 7 | 30)}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  intervalDays === option.value
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-gray-400 ml-2">({option.value} days)</span>
              </button>
            ))}
          </div>

          {/* #616: mini calendar preview — visible from step 1 onwards */}
          <ScheduleCalendarPreview
            intervalDays={intervalDays}
            endDate={endDate}
            useMaxOccurrences={useMaxOccurrences}
            maxOccurrences={maxOccurrences}
          />
        </div>
      )}

      {/* Step 2: End Date / Max Occurrences */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 2 of 3: Set duration</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!useMaxOccurrences}
                onChange={() => setUseMaxOccurrences(false)}
                className="w-4 h-4"
              />
              <span className="text-sm">End date</span>
            </label>
            {!useMaxOccurrences && (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={useMaxOccurrences}
                onChange={() => setUseMaxOccurrences(true)}
                className="w-4 h-4"
              />
              <span className="text-sm">Max occurrences</span>
            </label>
            {useMaxOccurrences && (
              <input
                type="number"
                min="1"
                max="52"
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
                placeholder="Number of invoices"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* #616: mini calendar updates as user changes end date / occurrences */}
          <ScheduleCalendarPreview
            intervalDays={intervalDays}
            endDate={endDate}
            useMaxOccurrences={useMaxOccurrences}
            maxOccurrences={maxOccurrences}
          />
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 3 of 3: Review schedule</p>
          <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-3">
              Planned invoice dates ({previewDates.length} total):
            </p>
            <ul className="space-y-2">
              {previewDates.map((date, i) => (
                <li key={i} className="text-sm text-gray-300">
                  {new Date(date).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>

          {/* #616: mini calendar on confirmation step too */}
          <ScheduleCalendarPreview
            intervalDays={intervalDays}
            endDate={endDate}
            useMaxOccurrences={useMaxOccurrences}
            maxOccurrences={maxOccurrences}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
