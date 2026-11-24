import { vi, describe, it, beforeEach, afterEach, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import CountdownTimer from "@/components/CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a human-readable countdown and updates every second", () => {
    const deadline = Math.floor(new Date("2026-07-01T15:00:00.000Z").getTime() / 1000);

    render(<CountdownTimer deadline={deadline} />);

    expect(screen.getByText("1d 1h 0m 0s remaining")).toBeTruthy() // element exists in DOM;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1d 0h 59m 59s remaining")).toBeTruthy() // element exists in DOM;
  });

  it("shows the absolute expiration date in the tooltip", () => {
    const deadline = Math.floor(new Date("2026-07-01T15:00:00.000Z").getTime() / 1000);

    render(<CountdownTimer deadline={deadline} />);

    const timer = screen.getByText("1d 1h 0m 0s remaining");
    expect(timer.getAttribute("title")).toBe("Expires July 1, 2026 at 15:00 UTC");
  });

  it("formats shorter durations and shows the expired label at zero", () => {
    const deadline = Math.floor(new Date("2026-06-30T14:01:30.000Z").getTime() / 1000);
    const { rerender } = render(<CountdownTimer deadline={deadline} />);

    expect(screen.getByText("0d 0h 1m 30s remaining")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(screen.getByText("Expired")).toBeTruthy();

    rerender(<CountdownTimer deadline={deadline - 10} />);
    expect(screen.getByText("Expired")).toBeTruthy();
  });
});
