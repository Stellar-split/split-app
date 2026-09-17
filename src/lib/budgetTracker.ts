const BUDGET_LIMIT_KEY = "stellarsplit_budget_limit_";
const BUDGET_SPENDING_KEY = "stellarsplit_budget_spending_";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface SpendingRecord {
  amount: string;
  timestamp: number;
}

export type OnOverspendCallback = (overspentBy: number, budgetId: string) => void;

export interface BudgetTrackerConfig {
  budgetId?: string;
  limitUsdc?: number;
  onOverspend?: OnOverspendCallback;
}

export interface RecordPaymentOptions {
  onOverspend?: OnOverspendCallback;
  budgetId?: string;
}

const trackerConfigs = new Map<string, BudgetTrackerConfig>();
let defaultTrackerConfig: BudgetTrackerConfig | null = null;

export function configureBudgetTracker(config: BudgetTrackerConfig): void;
export function configureBudgetTracker(id: string, config: BudgetTrackerConfig): void;
export function configureBudgetTracker(
  idOrConfig: string | BudgetTrackerConfig,
  maybeConfig?: BudgetTrackerConfig
): void {
  if (typeof idOrConfig === "string") {
    if (maybeConfig) {
      trackerConfigs.set(idOrConfig, maybeConfig);
      if (maybeConfig.limitUsdc !== undefined) {
        setBudgetLimit(idOrConfig, maybeConfig.limitUsdc);
      }
    }
  } else {
    defaultTrackerConfig = idOrConfig;
    if (idOrConfig.budgetId) {
      trackerConfigs.set(idOrConfig.budgetId, idOrConfig);
    }
    if (idOrConfig.limitUsdc !== undefined && idOrConfig.budgetId) {
      setBudgetLimit(idOrConfig.budgetId, idOrConfig.limitUsdc);
    }
  }
}

export function resetBudgetTrackerConfig(): void {
  trackerConfigs.clear();
  defaultTrackerConfig = null;
}

export function getBudgetLimit(address: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BUDGET_LIMIT_KEY + address);
  if (raw === null) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

export function setBudgetLimit(
  address: string,
  limitUsdc: number,
  options?: { onOverspend?: OnOverspendCallback; budgetId?: string }
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUDGET_LIMIT_KEY + address, String(limitUsdc));
  if (options?.onOverspend) {
    trackerConfigs.set(address, {
      budgetId: options.budgetId ?? address,
      limitUsdc,
      onOverspend: options.onOverspend,
    });
  }
}

export function clearBudgetLimit(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUDGET_LIMIT_KEY + address);
  trackerConfigs.delete(address);
}

function readSpendingRecords(address: string): SpendingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BUDGET_SPENDING_KEY + address) ?? "[]");
  } catch {
    return [];
  }
}

export function recordPayment(
  address: string,
  amount: bigint,
  options?: RecordPaymentOptions
): void {
  if (typeof window === "undefined") return;
  const prevSpent = getRollingSpending(address);
  const records = readSpendingRecords(address);
  records.push({ amount: amount.toString(), timestamp: Date.now() });
  localStorage.setItem(BUDGET_SPENDING_KEY + address, JSON.stringify(records));

  const limit = getBudgetLimit(address);
  if (limit !== null) {
    const limitUnits = BigInt(Math.round(limit * 10_000_000));
    const newSpent = prevSpent + amount;
    if (prevSpent <= limitUnits && newSpent > limitUnits) {
      const overspentByUnits = newSpent - limitUnits;
      const overspentBy = Number(overspentByUnits) / 10_000_000;
      const budgetId = options?.budgetId ?? trackerConfigs.get(address)?.budgetId ?? address;
      const callback =
        options?.onOverspend ??
        trackerConfigs.get(address)?.onOverspend ??
        defaultTrackerConfig?.onOverspend;
      if (callback) {
        callback(overspentBy, budgetId);
      }
    }
  }
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

export class BudgetTracker {
  constructor(public config: BudgetTrackerConfig = {}) {
    if (config.budgetId && config.limitUsdc !== undefined) {
      setBudgetLimit(config.budgetId, config.limitUsdc);
    }
    if (config.budgetId) {
      trackerConfigs.set(config.budgetId, config);
    }
  }

  recordPayment(amount: bigint, address?: string, options?: RecordPaymentOptions): void {
    const target = address ?? this.config.budgetId;
    if (!target) return;
    recordPayment(target, amount, {
      onOverspend: this.config.onOverspend,
      budgetId: this.config.budgetId,
      ...options,
    });
  }

  checkBudget(pendingAmount: bigint, address?: string) {
    const target = address ?? this.config.budgetId;
    if (!target) return { hasLimit: false, limitUnits: 0n, spent: 0n, wouldExceed: false };
    return checkBudget(target, pendingAmount);
  }
}
