/**
 * Unit tests for budgetTracker:
 * - Rolling 30-day window calculation (excludes records older than 30 days)
 * - Threshold warning trigger (wouldExceed when pending + spent > limit)
 * - No warning when no limit is configured
 */

import {
  setBudgetLimit,
  clearBudgetLimit,
  recordPayment,
  getRollingSpending,
  checkBudget,
  configureBudgetTracker,
  resetBudgetTrackerConfig,
  BudgetTracker,
} from "@/lib/budgetTracker";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

const ADDRESS = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// 1 USDC = 10_000_000 units
const USDC = (n: number) => BigInt(Math.round(n * 10_000_000));

beforeEach(() => {
  localStorageMock.clear();
});

describe("getRollingSpending — rolling 30-day window", () => {
  it("returns 0 when no payments recorded", () => {
    expect(getRollingSpending(ADDRESS)).toBe(0n);
  });

  it("counts payments within the last 30 days", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockImplementation(() => now);

    recordPayment(ADDRESS, USDC(100));
    recordPayment(ADDRESS, USDC(50));
    expect(getRollingSpending(ADDRESS)).toBe(USDC(150));

    jest.spyOn(Date, "now").mockRestore();
  });

  it("excludes payments older than 30 days", () => {
    const now = Date.now();
    const oldTimestamp = now - THIRTY_DAYS_MS - 1000;

    // Manually insert an old record
    const oldRecord = JSON.stringify([
      { amount: USDC(200).toString(), timestamp: oldTimestamp },
    ]);
    localStorage.setItem(`stellarsplit_budget_spending_${ADDRESS}`, oldRecord);

    jest.spyOn(Date, "now").mockImplementation(() => now);
    // Add a recent payment
    recordPayment(ADDRESS, USDC(30));

    expect(getRollingSpending(ADDRESS)).toBe(USDC(30));
    jest.spyOn(Date, "now").mockRestore();
  });

  it("includes a payment made exactly at the 30-day boundary", () => {
    const now = Date.now();
    const boundaryTimestamp = now - THIRTY_DAYS_MS;

    const record = JSON.stringify([
      { amount: USDC(100).toString(), timestamp: boundaryTimestamp },
    ]);
    localStorage.setItem(`stellarsplit_budget_spending_${ADDRESS}`, record);

    jest.spyOn(Date, "now").mockImplementation(() => now);
    expect(getRollingSpending(ADDRESS)).toBe(USDC(100));
    jest.spyOn(Date, "now").mockRestore();
  });
});

describe("checkBudget — threshold warning trigger", () => {
  it("returns hasLimit=false when no limit is set", () => {
    const result = checkBudget(ADDRESS, USDC(500));
    expect(result.hasLimit).toBe(false);
    expect(result.wouldExceed).toBe(false);
  });

  it("returns wouldExceed=false when pending + spent is below the limit", () => {
    setBudgetLimit(ADDRESS, 1000);
    recordPayment(ADDRESS, USDC(400));
    const result = checkBudget(ADDRESS, USDC(500));
    expect(result.hasLimit).toBe(true);
    expect(result.wouldExceed).toBe(false);
  });

  it("returns wouldExceed=true when pending + spent exceeds the limit", () => {
    setBudgetLimit(ADDRESS, 1000);
    recordPayment(ADDRESS, USDC(600));
    const result = checkBudget(ADDRESS, USDC(500));
    expect(result.hasLimit).toBe(true);
    expect(result.wouldExceed).toBe(true);
  });

  it("returns wouldExceed=true when pending alone exceeds the limit", () => {
    setBudgetLimit(ADDRESS, 100);
    const result = checkBudget(ADDRESS, USDC(200));
    expect(result.wouldExceed).toBe(true);
  });

  it("clears limit so checkBudget reports no limit", () => {
    setBudgetLimit(ADDRESS, 500);
    clearBudgetLimit(ADDRESS);
    const result = checkBudget(ADDRESS, USDC(600));
    expect(result.hasLimit).toBe(false);
  });
});

describe("onOverspend callback", () => {
  beforeEach(() => {
    resetBudgetTrackerConfig();
  });

  it("fires callback when payment pushes total above ceiling", () => {
    const onOverspend = jest.fn();
    setBudgetLimit(ADDRESS, 100, { onOverspend, budgetId: "budget-1" });

    recordPayment(ADDRESS, USDC(80));
    expect(onOverspend).not.toHaveBeenCalled();

    recordPayment(ADDRESS, USDC(30));
    expect(onOverspend).toHaveBeenCalledTimes(1);
    expect(onOverspend).toHaveBeenCalledWith(10, "budget-1");
  });

  it("fires exactly once when crossing ceiling and NOT on subsequent payments", () => {
    const onOverspend = jest.fn();
    setBudgetLimit(ADDRESS, 100, { onOverspend });

    recordPayment(ADDRESS, USDC(70));
    expect(onOverspend).not.toHaveBeenCalled();

    // Cross ceiling: 70 + 40 = 110 (overspent by 10)
    recordPayment(ADDRESS, USDC(40));
    expect(onOverspend).toHaveBeenCalledTimes(1);
    expect(onOverspend).toHaveBeenCalledWith(10, ADDRESS);

    // Subsequent payment: 110 + 20 = 130 (already exceeded)
    recordPayment(ADDRESS, USDC(20));
    expect(onOverspend).toHaveBeenCalledTimes(1);

    // Another subsequent payment: 130 + 50 = 180 (already exceeded)
    recordPayment(ADDRESS, USDC(50));
    expect(onOverspend).toHaveBeenCalledTimes(1);
  });

  it("calculates positive overspentBy difference correctly", () => {
    const onOverspend = jest.fn();
    setBudgetLimit(ADDRESS, 50, { onOverspend, budgetId: "dept-ops" });

    recordPayment(ADDRESS, USDC(75.5));
    expect(onOverspend).toHaveBeenCalledTimes(1);
    expect(onOverspend).toHaveBeenCalledWith(25.5, "dept-ops");
  });

  it("supports configuration via configureBudgetTracker", () => {
    const onOverspend = jest.fn();
    configureBudgetTracker({
      budgetId: ADDRESS,
      limitUsdc: 200,
      onOverspend,
    });

    recordPayment(ADDRESS, USDC(150));
    expect(onOverspend).not.toHaveBeenCalled();

    recordPayment(ADDRESS, USDC(70));
    expect(onOverspend).toHaveBeenCalledTimes(1);
    expect(onOverspend).toHaveBeenCalledWith(20, ADDRESS);
  });

  it("supports configuration via BudgetTracker instance", () => {
    const onOverspend = jest.fn();
    const tracker = new BudgetTracker({
      budgetId: "project-x",
      limitUsdc: 100,
      onOverspend,
    });

    tracker.recordPayment(USDC(90));
    expect(onOverspend).not.toHaveBeenCalled();

    tracker.recordPayment(USDC(25));
    expect(onOverspend).toHaveBeenCalledTimes(1);
    expect(onOverspend).toHaveBeenCalledWith(15, "project-x");

    // Subsequent payment does not re-trigger
    tracker.recordPayment(USDC(10));
    expect(onOverspend).toHaveBeenCalledTimes(1);
  });
});
