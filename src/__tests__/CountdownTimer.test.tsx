import { act, render, screen } from "@testing-library/react";
import CountdownTimer from "@/components/CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-30T14:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders a human-readable countdown and updates every second", () => {
    const deadline = Math.floor(new Date("2026-07-01T15:00:00.000Z").getTime() / 1000);

    render(<CountdownTimer deadline={deadline} />);

    expect(screen.getByText("1d 1h 0m 0s remaining")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1d 0h 59m 59s remaining")).toBeInTheDocument();
  });

  it("shows the absolute expiration date in the tooltip", () => {
    const deadline = Math.floor(new Date("2026-07-01T15:00:00.000Z").getTime() / 1000);

    render(<CountdownTimer deadline={deadline} />);

    const timer = screen.getByText("1d 1h 0m 0s remaining");
    expect(timer).toHaveAttribute("title", "Expires July 1, 2026 at 15:00 UTC");
  });
});
