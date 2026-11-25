export type EventType = "workshop" | "meetup" | "webinar" | "hackathon";

export interface CommunityEvent {
  id: string;
  title: string;
  type: EventType;
  /** ISO 8601 start time. */
  startsAt: string;
  location?: string;
  description?: string;
}

export const EVENT_TYPES: EventType[] = ["workshop", "meetup", "webinar", "hackathon"];

const byStart = (a: CommunityEvent, b: CommunityEvent) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

/** Events of one type (or all), earliest first. Events with an invalid date are dropped. */
export function filterEvents(events: CommunityEvent[], type: EventType | "all" = "all"): CommunityEvent[] {
  return events
    .filter((e) => !Number.isNaN(Date.parse(e.startsAt)))
    .filter((e) => type === "all" || e.type === type)
    .sort(byStart);
}

/** Events starting at or after `now`, earliest first. */
export function upcomingEvents(events: CommunityEvent[], now: Date = new Date()): CommunityEvent[] {
  return filterEvents(events).filter((e) => Date.parse(e.startsAt) >= now.getTime());
}

/** Local `YYYY-MM-DD` key for a date. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function groupEventsByDay(events: CommunityEvent[]): Map<string, CommunityEvent[]> {
  const groups = new Map<string, CommunityEvent[]>();
  for (const event of filterEvents(events)) {
    const key = dayKey(new Date(event.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return groups;
}

/**
 * Cells for a Sunday-first month grid: leading `null`s pad the first week, and
 * the result is padded to a whole number of weeks.
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** RSVP set helpers (immutable). */
export function toggleRsvp(rsvps: ReadonlySet<string>, eventId: string): Set<string> {
  const next = new Set(rsvps);
  if (!next.delete(eventId)) next.add(eventId);
  return next;
}
