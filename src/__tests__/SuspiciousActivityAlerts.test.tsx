import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SuspiciousActivityAlerts from "@/components/security/SuspiciousActivityAlerts";
import { detectSuspiciousActivity, type ActivityEvent } from "@/lib/suspiciousActivity";

const normal: ActivityEvent[] = [
  { id: "a", actor: "GA", amount: 10, timestamp: 0 },
  { id: "b", actor: "GB", amount: 12, timestamp: 100_000 },
  { id: "c", actor: "GC", amount: 11, timestamp: 200_000 },
];

describe("detectSuspiciousActivity", () => {
  it("returns no alerts for normal activity", () => {
    expect(detectSuspiciousActivity(normal)).toEqual([]);
  });

  it("flags velocity bursts, amount spikes and repeated amounts", () => {
    const burst = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, actor: "GX", amount: 5 + i, timestamp: i * 1000 }));
    const repeats = Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, actor: "GR", amount: 7, timestamp: i * 600_000 }));
    const spike = { id: "s", actor: "GS", amount: 10_000, timestamp: 0 };
    const alerts = detectSuspiciousActivity([...normal, ...burst, ...repeats, spike]);
    expect(alerts.map((a) => a.rule)).toEqual(["velocity", "amount_spike", "repeated_amount"]);
    expect(alerts[0].eventIds).toHaveLength(6);
  });
});

describe("SuspiciousActivityAlerts", () => {
  it("shows empty state and dismisses alerts", () => {
    const { rerender } = render(<SuspiciousActivityAlerts events={normal} />);
    expect(screen.getByText("No suspicious activity detected.")).toBeInTheDocument();
    rerender(<SuspiciousActivityAlerts events={[...normal, { id: "s", actor: "GS", amount: 9999, timestamp: 0 }]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/medium risk/i);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
