import { generateICS, type ICSEvent } from "@/lib/icsExport";

const FIXED_STAMP = new Date("2025-01-15T12:00:00Z");

function makeEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
  return {
    uid: "test-uid-1@stellarsplit",
    summary: "Payout to Alice",
    description: "Invoice #42 payout",
    date: new Date("2025-02-01T00:00:00Z"),
    ...overrides,
  };
}

describe("generateICS — single event", () => {
  it("produces valid iCalendar structure", () => {
    const ics = generateICS([makeEvent()], FIXED_STAMP);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:test-uid-1@stellarsplit");
    expect(ics).toContain("SUMMARY:Payout to Alice");
  });
});

describe("generateICS — multiple events", () => {
  it("includes correct number of VEVENT blocks", () => {
    const events: ICSEvent[] = [
      makeEvent({ uid: "uid-1" }),
      makeEvent({ uid: "uid-2", summary: "Payout to Bob" }),
      makeEvent({ uid: "uid-3", summary: "Payout to Carol" }),
    ];
    const ics = generateICS(events, FIXED_STAMP);

    const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(3);

    expect(ics).toContain("UID:uid-1");
    expect(ics).toContain("UID:uid-2");
    expect(ics).toContain("UID:uid-3");
  });
});

describe("generateICS — VALARM reminder", () => {
  it("includes a 1-day-before reminder in each event", () => {
    const events = [makeEvent({ uid: "a" }), makeEvent({ uid: "b" })];
    const ics = generateICS(events, FIXED_STAMP);

    const alarmCount = (ics.match(/BEGIN:VALARM/g) || []).length;
    expect(alarmCount).toBe(2);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("ACTION:DISPLAY");
  });
});

describe("generateICS — zero events", () => {
  it("returns valid iCalendar with no VEVENT", () => {
    const ics = generateICS([], FIXED_STAMP);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("generateICS — date formatting", () => {
  it("formats dates as YYYYMMDD VALUE=DATE", () => {
    const event = makeEvent({ date: new Date("2025-12-25T00:00:00Z") });
    const ics = generateICS([event], FIXED_STAMP);

    expect(ics).toContain("DTSTART;VALUE=DATE:20251225");
  });

  it("formats DTSTAMP correctly", () => {
    const ics = generateICS([makeEvent()], FIXED_STAMP);

    expect(ics).toContain("DTSTAMP:20250115T120000Z");
  });

  it("pads single-digit months and days", () => {
    const event = makeEvent({ date: new Date("2025-03-05T00:00:00Z") });
    const ics = generateICS([event], FIXED_STAMP);

    expect(ics).toContain("DTSTART;VALUE=DATE:20250305");
  });
});
