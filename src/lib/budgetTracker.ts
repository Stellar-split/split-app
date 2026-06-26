const BUDGET_LIMIT_KEY = "stellarsplit_budget_limit_";
const BUDGET_SPENDING_KEY = "stellarsplit_budget_spending_";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface SpendingRecord {
  amount: string;
  timestamp: number;
}

export function getBudgetLimit(address: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BUDGET_LIMIT_KEY + address);
  if (raw === null) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

export function setBudgetLimit(address: string, limitUsdc: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_LIMIT_KEY + address, String(limitUsdc));
}

export function clearBudgetLimit(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUDGET_LIMIT_KEY + address);
}

function readSpendingRecords(address: string): SpendingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BUDGET_SPENDING_KEY + address) ?? "[]");
  } catch {
    return [];
  }
}

export function recordPayment(address: string, amount: bigint): void {
  if (typeof window === "undefined") return;
  const records = readSpendingRecords(address);
  records.push({ amount: amount.toString(), timestamp: Date.now() });
  localStorage.setItem(BUDGET_SPENDING_KEY + address, JSON.stringify(records));
}

/** Returns total spending in SDK units (1 USDC = 10,000,000 units) within the last 30 days. */
export function getRollingSpending(address: string): bigint {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return readSpendingRecords(address)
    .filter((r) => r.timestamp >= cutoff)
    .reduce((sum, r) => sum + BigInt(r.amount), 0n);
}

/**
 * Checks whether adding pendingAmount would exceed the configured budget.
 * Returns hasLimit=false if no limit is set.
 * limitUnits and spent are in SDK units (1 USDC = 10,000,000 units).
 */
export function checkBudget(
  address: string,
  pendingAmount: bigint
): { hasLimit: boolean; limitUnits: bigint; spent: bigint; wouldExceed: boolean } {
  const limit = getBudgetLimit(address);
  if (limit === null) {
    return { hasLimit: false, limitUnits: 0n, spent: 0n, wouldExceed: false };
  }
  const limitUnits = BigInt(Math.round(limit * 10_000_000));
  const spent = getRollingSpending(address);
  return { hasLimit: true, limitUnits, spent, wouldExceed: spent + pendingAmount > limitUnits };
}
