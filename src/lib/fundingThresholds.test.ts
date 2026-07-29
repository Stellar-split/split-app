import { describe, it, expect } from "vitest";
import { crossedMilestones, fundedPercent } from "./fundingThresholds";

describe("fundedPercent", () => {
  it("computes percent funded", () => {
    expect(fundedPercent(50n, 100n)).toBe(50);
    expect(fundedPercent(25n, 100n)).toBe(25);
    expect(fundedPercent(100n, 100n)).toBe(100);
  });

  it("returns 0 when total is zero to avoid division by zero", () => {
    expect(fundedPercent(0n, 0n)).toBe(0);
  });

  it("clamps to 100 when overfunded", () => {
    expect(fundedPercent(150n, 100n)).toBe(100);
  });

  it("handles large bigint amounts without precision loss at whole percents", () => {
    const total = 1_000_000_000_000n;
    expect(fundedPercent(total / 4n, total)).toBe(25);
  });
});

describe("crossedMilestones", () => {
  it("returns all milestones at or below the current percent", () => {
    expect(crossedMilestones(60, [])).toEqual([25, 50]);
  });

  it("excludes milestones already notified", () => {
    expect(crossedMilestones(100, [25, 50])).toEqual([75, 100]);
  });

  it("returns an empty array once every milestone is notified", () => {
    expect(crossedMilestones(100, [25, 50, 75, 100])).toEqual([]);
  });

  it("returns nothing below the first milestone", () => {
    expect(crossedMilestones(10, [])).toEqual([]);
  });

  it("fires each milestone at most once regardless of repeated calls at the same percent", () => {
    const alreadyNotified = new Set<number>();
    const first = crossedMilestones(50, alreadyNotified);
    first.forEach((m) => alreadyNotified.add(m));
    const second = crossedMilestones(50, alreadyNotified);
    expect(first).toEqual([25, 50]);
    expect(second).toEqual([]);
  });
});
