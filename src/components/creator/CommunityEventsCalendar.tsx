"use client";

import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  dayKey,
  filterEvents,
  groupEventsByDay,
  monthGrid,
  toggleRsvp,
  type CommunityEvent,
  type EventType,
} from "@/lib/creatorEvents";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  events: CommunityEvent[];
  /** Month to show first; defaults to the current month. */
  initialDate?: Date;
  onRsvpChange?: (eventIds: string[]) => void;
}

export default function CommunityEventsCalendar({ events, initialDate, onRsvpChange }: Props) {
  const start = initialDate ?? new Date();
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [type, setType] = useState<EventType | "all">("all");
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());

  const visible = useMemo(() => filterEvents(events, type), [events, type]);
  const byDay = useMemo(() => groupEventsByDay(visible), [visible]);
  const monthEvents = useMemo(
    () =>
      visible.filter((e) => {
        const d = new Date(e.startsAt);
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [visible, year, month],
  );

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  const rsvp = (id: string) => {
    const next = toggleRsvp(rsvps, id);
    setRsvps(next);
    onRsvpChange?.([...next]);
  };
  const title = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <section className="space-y-4" aria-label="Community events calendar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" className="rounded border px-2 py-1" onClick={() => shift(-1)}>
            ‹
          </button>
          <h2 className="min-w-[10rem] text-center font-semibold" aria-live="polite">
            {title}
          </h2>
          <button type="button" aria-label="Next month" className="rounded border px-2 py-1" onClick={() => shift(1)}>
            ›
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Event type
          <select
            className="rounded border px-2 py-1"
            value={type}
            onChange={(e) => setType(e.target.value as EventType | "all")}
          >
            <option value="all">All</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden grid-cols-7 gap-1 text-xs sm:grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="p-1 text-center font-medium text-gray-500" role="columnheader">
            {d}
          </div>
        ))}
        {monthGrid(year, month).map((cell, i) => {
          const dayEvents = cell ? (byDay.get(dayKey(cell)) ?? []) : [];
          return (
            <div key={i} role="gridcell" className="min-h-[4.5rem] rounded border p-1">
              {cell && <span className="text-gray-500">{cell.getDate()}</span>}
              {dayEvents.map((e) => (
                <div key={e.id} className="mt-1 truncate rounded bg-blue-50 px-1 text-blue-800" title={e.title}>
                  {e.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <ul className="space-y-2" aria-label="Events this month">
        {monthEvents.length === 0 && <li className="text-sm text-gray-500">No events this month.</li>}
        {monthEvents.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 rounded border p-3">
            <div>
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-gray-600">
                <time dateTime={e.startsAt}>{new Date(e.startsAt).toLocaleString()}</time> · {e.type}
                {e.location ? ` · ${e.location}` : ""}
              </p>
              {e.description && <p className="mt-1 text-sm">{e.description}</p>}
            </div>
            <button
              type="button"
              aria-pressed={rsvps.has(e.id)}
              className="rounded border px-3 py-1 text-sm"
              onClick={() => rsvp(e.id)}
            >
              {rsvps.has(e.id) ? "Going" : "RSVP"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
