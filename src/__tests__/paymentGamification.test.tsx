import { render, screen } from "@testing-library/react";
import PaymentGamificationPanel from "@/components/PaymentGamificationPanel";
import {
  computeGamification,
  levelForPoints,
  paymentStreakDays,
  pointsForPayment,
  type PaymentEvent,
} from "@/lib/paymentGamification";

const ev = (day: string, overrides: Partial<PaymentEvent> = {}): PaymentEvent => ({
  invoiceId: `inv-${day}`,
  amount: 10,
  paidAt: `${day}T12:00:00Z`,
  ...overrides,
});

describe("pointsForPayment", () => {
  it("awards base points plus an on-time bonus and a capped amount bonus", () => {
    expect(pointsForPayment(ev("2026-01-01", { amount: 0 }))).toBe(10);
    expect(pointsForPayment(ev("2026-01-01", { amount: 0, onTime: true }))).toBe(15);
    expect(pointsForPayment(ev("2026-01-01", { amount: 55 }))).toBe(15);
    expect(pointsForPayment(ev("2026-01-01", { amount: 100000 }))).toBe(30);
  });
});

describe("levelForPoints", () => {
  it("returns the highest level whose threshold is met", () => {
    expect(levelForPoints(0).name).toBe("Starter");
    expect(levelForPoints(49).name).toBe("Starter");
    expect(levelForPoints(50).name).toBe("Contributor");
    expect(levelForPoints(5000).name).toBe("Legend");
  });
});

describe("paymentStreakDays", () => {
  it("counts consecutive days ending at the latest payment", () => {
    expect(paymentStreakDays([ev("2026-01-01"), ev("2026-01-02"), ev("2026-01-03")])).toBe(3);
    expect(paymentStreakDays([ev("2026-01-01"), ev("2026-01-03"), ev("2026-01-04")])).toBe(2);
  });

  it("ignores duplicate days and handles no events", () => {
    expect(paymentStreakDays([ev("2026-01-01"), ev("2026-01-01")])).toBe(1);
    expect(paymentStreakDays([])).toBe(0);
  });
});

describe("computeGamification", () => {
  it("has no badges and level 1 with no payments", () => {
    const s = computeGamification([]);
    expect(s.points).toBe(0);
    expect(s.level.level).toBe(1);
    expect(s.levelProgress).toBe(0);
    expect(s.badges.every((b) => !b.earned)).toBe(true);
  });

  it("earns badges and reports progress", () => {
    const s = computeGamification([
      ev("2026-01-01", { onTime: true }),
      ev("2026-01-02", { onTime: true }),
      ev("2026-01-03", { onTime: true }),
    ]);
    const earned = s.badges.filter((b) => b.earned).map((b) => b.id);
    expect(earned).toEqual(["first-payment", "on-time-3", "streak-3"]);
    expect(s.points).toBe(48);
    expect(s.level.name).toBe("Starter");
    expect(s.nextLevel?.name).toBe("Contributor");
    expect(s.levelProgress).toBeCloseTo(48 / 50);
  });

  it("reports full progress at the top level", () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      ev(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, { amount: 1000, onTime: true }),
    );
    const s = computeGamification(events);
    expect(s.level.name).toBe("Legend");
    expect(s.nextLevel).toBeNull();
    expect(s.levelProgress).toBe(1);
  });
});

describe("PaymentGamificationPanel", () => {
  it("renders level, points, progress and badges", () => {
    render(
      <PaymentGamificationPanel
        events={[ev("2026-01-01", { onTime: true }), ev("2026-01-02", { onTime: true })]}
      />,
    );
    expect(screen.getByText("Level 1: Starter")).toBeInTheDocument();
    expect(screen.getByText("32 points")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "64");
    expect(screen.getByText("18 points to Contributor")).toBeInTheDocument();
    const badge = screen.getByText("First payment").closest("li");
    expect(badge).toHaveAttribute("data-earned", "true");
    expect(screen.getByText("Regular").closest("li")).toHaveAttribute("data-earned", "false");
  });

  it("shows the empty state for no payments", () => {
    render(<PaymentGamificationPanel events={[]} />);
    expect(screen.getByText("0 points")).toBeInTheDocument();
    expect(screen.getByText("50 points to Contributor")).toBeInTheDocument();
  });
});
