import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CommunityEventsCalendar from "@/components/creator/CommunityEventsCalendar";
import {
  filterEvents,
  groupEventsByDay,
  monthGrid,
  toggleRsvp,
  upcomingEvents,
  type CommunityEvent,
} from "@/lib/creatorEvents";

const events: CommunityEvent[] = [
  { id: "b", title: "Invoice meetup", type: "meetup", startsAt: "2026-03-20T15:00:00", location: "Lagos" },
  { id: "a", title: "Splits workshop", type: "workshop", startsAt: "2026-03-05T10:00:00" },
  { id: "c", title: "April webinar", type: "webinar", startsAt: "2026-04-02T10:00:00" },
  { id: "bad", title: "Broken", type: "meetup", startsAt: "not-a-date" },
];

describe("creatorEvents", () => {
  it("sorts, filters by type and drops invalid dates", () => {
    expect(filterEvents(events).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(filterEvents(events, "meetup").map((e) => e.id)).toEqual(["b"]);
  });

  it("returns only upcoming events", () => {
    expect(upcomingEvents(events, new Date("2026-03-10T00:00:00")).map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("groups events by local day", () => {
    const groups = groupEventsByDay(events);
    expect(groups.get("2026-03-05")?.map((e) => e.id)).toEqual(["a"]);
  });

  it("builds whole-week month grids", () => {
    const grid = monthGrid(2026, 2); // March 2026 starts on a Sunday
    expect(grid.length % 7).toBe(0);
    expect(grid[0]?.getDate()).toBe(1);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it("toggles RSVPs without mutating the input", () => {
    const empty = new Set<string>();
    const one = toggleRsvp(empty, "a");
    expect(one.has("a")).toBe(true);
    expect(empty.size).toBe(0);
    expect(toggleRsvp(one, "a").has("a")).toBe(false);
  });
});

describe("CommunityEventsCalendar", () => {
  it("shows the month's events, filters by type and navigates months", () => {
    render(<CommunityEventsCalendar events={events} initialDate={new Date(2026, 2, 1)} />);
    expect(screen.getByRole("heading", { name: "March 2026" })).toBeInTheDocument();
    expect(screen.getAllByText("Splits workshop").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "meetup" } });
    expect(screen.queryByText(/Splits workshop/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByRole("heading", { name: "April 2026" })).toBeInTheDocument();
    expect(screen.getByText("No events this month.")).toBeInTheDocument();
  });

  it("toggles RSVP and reports it", () => {
    const onRsvpChange = vi.fn();
    render(<CommunityEventsCalendar events={events} initialDate={new Date(2026, 2, 1)} onRsvpChange={onRsvpChange} />);
    fireEvent.click(screen.getAllByText("RSVP")[0]);
    expect(onRsvpChange).toHaveBeenLastCalledWith(["a"]);
    expect(screen.getByText("Going")).toHaveAttribute("aria-pressed", "true");
  });
});
