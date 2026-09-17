export interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  date: Date;
}

export interface ICSOptions {
  dtstamp?: Date;
  timezone?: string;
}

function formatDateValue(date: Date): string {
  const y = date.getUTCFullYear().toString();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDTStamp(date: Date): string {
  const y = date.getUTCFullYear().toString();
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const h = date.getUTCHours().toString().padStart(2, "0");
  const mi = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function formatOffset(date: Date, timeZone: string): string {
  try {
    const str = date.toLocaleString("en-US", { timeZone, timeZoneName: "longOffset" });
    const match = str.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (match) {
      const hours = match[1];
      const minutes = match[2] ?? "00";
      return `${hours}${minutes}`;
    }
  } catch {
    // fallback
  }
  return "+0000";
}

function getTzName(date: Date, timeZone: string): string {
  try {
    const str = date.toLocaleString("en-US", { timeZone, timeZoneName: "short" });
    const parts = str.split(" ");
    return parts[parts.length - 1] ?? timeZone;
  } catch {
    return timeZone;
  }
}

function generateVTimezone(timeZone: string, referenceDate: Date = new Date()): string[] {
  const offset = formatOffset(referenceDate, timeZone);
  const tzName = getTzName(referenceDate, timeZone);

  return [
    "BEGIN:VTIMEZONE",
    `TZID:${timeZone}`,
    `X-LIC-LOCATION:${timeZone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${tzName}`,
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

function formatLocalDateTime(date: Date, timeZone?: string): string {
  if (!timeZone) {
    return `${formatDateValue(date)}T000000`;
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const year = getPart("year").padStart(4, "0");
    const month = getPart("month").padStart(2, "0");
    const day = getPart("day").padStart(2, "0");
    let hour = getPart("hour").padStart(2, "0");
    if (hour === "24") hour = "00";
    const minute = getPart("minute").padStart(2, "0");
    const second = getPart("second").padStart(2, "0");
    return `${year}${month}${day}T${hour}${minute}${second}`;
  } catch {
    return `${formatDateValue(date)}T000000`;
  }
}

export function generateICS(
  events: ICSEvent[],
  dtstampOrOptions?: Date | string | ICSOptions,
  timezoneArg?: string,
): string {
  let dtstamp: Date | undefined;
  let timezone: string | undefined;

  if (typeof dtstampOrOptions === "string") {
    timezone = dtstampOrOptions;
  } else if (dtstampOrOptions instanceof Date) {
    dtstamp = dtstampOrOptions;
    timezone = timezoneArg;
  } else if (dtstampOrOptions && typeof dtstampOrOptions === "object") {
    dtstamp = dtstampOrOptions.dtstamp;
    timezone = dtstampOrOptions.timezone ?? timezoneArg;
  }

  const stamp = formatDTStamp(dtstamp ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StellarSplit//PayoutCalendar//EN",
    "CALSCALE:GREGORIAN",
  ];

  if (timezone) {
    lines.push(...generateVTimezone(timezone, dtstamp ?? new Date()));
  }

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      timezone
        ? `DTSTART;TZID=${timezone}:${formatLocalDateTime(event.date, timezone)}`
        : `DTSTART;VALUE=DATE:${formatDateValue(event.date)}`,
      `SUMMARY:${event.summary}`,
      `DESCRIPTION:${event.description}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(content: string, filename: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
