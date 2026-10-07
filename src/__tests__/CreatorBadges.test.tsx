import React from "react";
import { render, screen } from "@testing-library/react";
import CreatorBadges, { deriveCreatorStats, BADGE_DEFINITIONS } from "@/components/CreatorBadges";
import type { CreatorStats } from "@/components/CreatorBadges";

// ─── deriveCreatorStats unit tests ────────────────────────────────────────────

describe("deriveCreatorStats (#801)", () => {
  const makeInvoice = (overrides: Partial<{
    status: string;
    funded: bigint;
    payments: { payer: string }[];
    createdAt: number;
    deadline: number;
  }> = {}) => ({
    status: "Released",
    funded: 10_000_000n,   // 1 USDC
    payments: [{ payer: "GABC" }],
    deadline: Math.floor(Date.now() / 1000),
    ...overrides,
  });

  it("returns 0 for all stats with empty invoices", () => {
    const stats = deriveCreatorStats([], 50);
    expect(stats.totalInvoices).toBe(0);
    expect(stats.releasedInvoices).toBe(0);
    expect(stats.totalVolumeUsdc).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.uniquePayers).toBe(0);
  });

  it("counts totalInvoices correctly", () => {
    const stats = deriveCreatorStats([makeInvoice(), makeInvoice(), makeInvoice()], 50);
    expect(stats.totalInvoices).toBe(3);
  });

  it("counts only Released invoices for releasedInvoices", () => {
    const stats = deriveCreatorStats([
      makeInvoice({ status: "Released" }),
      makeInvoice({ status: "Pending" }),
    ], 50);
    expect(stats.releasedInvoices).toBe(1);
  });

  it("computes completionRate as percentage", () => {
    const stats = deriveCreatorStats([
      makeInvoice({ status: "Released" }),
      makeInvoice({ status: "Released" }),
      makeInvoice({ status: "Pending" }),
      makeInvoice({ status: "Pending" }),
    ], 50);
    expect(stats.completionRate).toBe(50);
  });

  it("computes totalVolumeUsdc from released invoices only", () => {
    const stats = deriveCreatorStats([
      makeInvoice({ status: "Released", funded: 10_000_000n }),  // 1 USDC
      makeInvoice({ status: "Pending", funded: 10_000_000n }),   // should not count
    ], 50);
    expect(stats.totalVolumeUsdc).toBeCloseTo(1);
  });

  it("counts unique payers across all invoices", () => {
    const stats = deriveCreatorStats([
      makeInvoice({ payments: [{ payer: "GA1" }, { payer: "GA2" }] }),
      makeInvoice({ payments: [{ payer: "GA1" }, { payer: "GA3" }] }),
    ], 50);
    expect(stats.uniquePayers).toBe(3);
  });

  it("preserves reputationScore as provided", () => {
    const stats = deriveCreatorStats([], 75);
    expect(stats.reputationScore).toBe(75);
  });
});

// ─── BADGE_DEFINITIONS unit tests ────────────────────────────────────────────

describe("BADGE_DEFINITIONS checks (#801)", () => {
  const base: CreatorStats = {
    totalInvoices: 0,
    releasedInvoices: 0,
    totalVolumeUsdc: 0,
    completionRate: 0,
    reputationScore: 0,
    uniquePayers: 0,
    streakWeeks: 0,
  };

  it("first-invoice badge earned at 1 invoice", () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.id === "first-invoice")!;
    expect(badge.check({ ...base, totalInvoices: 0 })).toBe(false);
    expect(badge.check({ ...base, totalInvoices: 1 })).toBe(true);
  });

  it("invoice-100 badge earned at 100 invoices", () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.id === "invoice-100")!;
    expect(badge.check({ ...base, totalInvoices: 99 })).toBe(false);
    expect(badge.check({ ...base, totalInvoices: 100 })).toBe(true);
  });

  it("volume-100k badge earned at 100k USDC", () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.id === "volume-100k")!;
    expect(badge.check({ ...base, totalVolumeUsdc: 99_999 })).toBe(false);
    expect(badge.check({ ...base, totalVolumeUsdc: 100_000 })).toBe(true);
  });

  it("completion-100 requires 100% and at least 5 invoices", () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.id === "completion-100")!;
    expect(badge.check({ ...base, completionRate: 100, totalInvoices: 4 })).toBe(false);
    expect(badge.check({ ...base, completionRate: 100, totalInvoices: 5 })).toBe(true);
    expect(badge.check({ ...base, completionRate: 99, totalInvoices: 10 })).toBe(false);
  });

  it("streak-12 badge earned at 12 weeks", () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.id === "streak-12")!;
    expect(badge.check({ ...base, streakWeeks: 11 })).toBe(false);
    expect(badge.check({ ...base, streakWeeks: 12 })).toBe(true);
  });
});

// ─── CreatorBadges component tests ───────────────────────────────────────────

describe("CreatorBadges component (#801)", () => {
  const emptyStats: CreatorStats = {
    totalInvoices: 0,
    releasedInvoices: 0,
    totalVolumeUsdc: 0,
    completionRate: 0,
    reputationScore: 0,
    uniquePayers: 0,
    streakWeeks: 0,
  };

  it("renders the section heading", () => {
    render(<CreatorBadges stats={emptyStats} />);
    expect(screen.getByRole("heading", { name: /badges & achievements/i })).toBeInTheDocument();
  });

  it("shows 0 earned message when no badges earned", () => {
    render(<CreatorBadges stats={emptyStats} />);
    expect(screen.getByText(/0 of/i)).toBeInTheDocument();
    expect(screen.getByText(/no badges earned yet/i)).toBeInTheDocument();
  });

  it("renders Earned section when badges are earned", () => {
    const stats: CreatorStats = { ...emptyStats, totalInvoices: 1 };
    render(<CreatorBadges stats={stats} />);
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.getByText("First Invoice")).toBeInTheDocument();
  });

  it("renders Locked section by default", () => {
    render(<CreatorBadges stats={emptyStats} />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("hides locked section when showLocked=false", () => {
    render(<CreatorBadges stats={emptyStats} showLocked={false} />);
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });

  it("shows tier summary pills for earned badges", () => {
    const stats: CreatorStats = {
      ...emptyStats,
      totalInvoices: 1,
      reputationScore: 50,
      completionRate: 50,
    };
    render(<CreatorBadges stats={stats} />);
    // "bronze" pill should appear (first-invoice, completion-50, rep-50 all bronze)
    expect(screen.getAllByText(/bronze/i).length).toBeGreaterThan(0);
  });

  it("shows next badge hint", () => {
    render(<CreatorBadges stats={emptyStats} />);
    expect(screen.getByText(/next up/i)).toBeInTheDocument();
  });

  it("shows correct earned count", () => {
    const stats: CreatorStats = { ...emptyStats, totalInvoices: 10, reputationScore: 50 };
    render(<CreatorBadges stats={stats} />);
    // first-invoice + invoice-10 + rep-50 → 3 badges
    const heading = screen.getByText(/of \d+ earned/);
    expect(heading.textContent).toMatch(/3 of/);
  });

  it("earned badge has aria-label with '— earned'", () => {
    const stats: CreatorStats = { ...emptyStats, totalInvoices: 1 };
    render(<CreatorBadges stats={stats} />);
    expect(screen.getByLabelText(/first invoice — earned/i)).toBeInTheDocument();
  });

  it("locked badge has aria-label with '— locked'", () => {
    render(<CreatorBadges stats={emptyStats} />);
    expect(screen.getByLabelText(/invoice veteran — locked/i)).toBeInTheDocument();
  });
});
