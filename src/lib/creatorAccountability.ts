export interface AccountabilityInput {
  totalInvoices: number;
  fulfilledInvoices: number;
  cancelledInvoices: number;
  disputes: number;
  disputesLost: number;
  /** Average time the creator takes to respond to payer messages, in hours. */
  avgResponseHours: number;
}

export type AccountabilityGrade = "A" | "B" | "C" | "D" | "F" | "unrated";

export interface AccountabilityResult {
  /** 0-100, or null when there is not enough history to rate the creator. */
  score: number | null;
  grade: AccountabilityGrade;
  breakdown: { fulfillment: number; disputes: number; responsiveness: number };
}

/** Minimum invoices before a creator is rated. */
export const MIN_INVOICES_FOR_SCORE = 3;

const FAST_RESPONSE_HOURS = 4;
const SLOW_RESPONSE_HOURS = 72;

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function gradeForScore(score: number): Exclude<AccountabilityGrade, "unrated"> {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Weights: fulfilment 50, disputes 30 (a lost dispute counts double), responsiveness 20.
 * Cancelled invoices count against fulfilment.
 */
export function computeAccountabilityScore(input: AccountabilityInput): AccountabilityResult {
  const total = input.totalInvoices;
  if (total < MIN_INVOICES_FOR_SCORE) {
    return { score: null, grade: "unrated", breakdown: { fulfillment: 0, disputes: 0, responsiveness: 0 } };
  }

  const fulfilledShare = clamp01((input.fulfilledInvoices - input.cancelledInvoices * 0.5) / total);
  const disputePenalty = clamp01((input.disputes + input.disputesLost) / total);
  const responseShare = clamp01(
    (SLOW_RESPONSE_HOURS - input.avgResponseHours) / (SLOW_RESPONSE_HOURS - FAST_RESPONSE_HOURS),
  );

  const breakdown = {
    fulfillment: Math.round(fulfilledShare * 50),
    disputes: Math.round((1 - disputePenalty) * 30),
    responsiveness: Math.round(responseShare * 20),
  };
  const score = breakdown.fulfillment + breakdown.disputes + breakdown.responsiveness;
  return { score, grade: gradeForScore(score), breakdown };
}

/** Live accountability metrics tracked per creator address. */
export interface AccountabilityMetrics extends AccountabilityInput {
  /** Last time the metrics changed, as an epoch millisecond timestamp. */
  updatedAt: number;
  /** Latest computed result, kept in sync with the raw metrics. */
  result: AccountabilityResult;
}

export type AccountabilityEvent =
  | { type: "invoice_fulfilled" }
  | { type: "invoice_cancelled" }
  | { type: "invoice_created" }
  | { type: "dispute_opened" }
  | { type: "dispute_lost" }
  | { type: "response_time"; hours: number };

export const ACCOUNTABILITY_UPDATED_EVENT = "stellarsplit:accountability-updated";

export interface AccountabilityUpdateDetail {
  address: string;
  metrics: AccountabilityMetrics;
}

type AccountabilityListener = (metrics: AccountabilityMetrics) => void;

const emptyInput = (): AccountabilityInput => ({
  totalInvoices: 0,
  fulfilledInvoices: 0,
  cancelledInvoices: 0,
  disputes: 0,
  disputesLost: 0,
  avgResponseHours: 0,
});

const metricsStore = new Map<string, AccountabilityMetrics>();
const listeners = new Map<string, Set<AccountabilityListener>>();

const normalizeAddress = (address: string) => address.trim().toLowerCase();

function buildMetrics(input: AccountabilityInput): AccountabilityMetrics {
  return {
    ...input,
    updatedAt: Date.now(),
    result: computeAccountabilityScore(input),
  };
}

function emitUpdate(address: string, metrics: AccountabilityMetrics): void {
  const detail: AccountabilityUpdateDetail = { address, metrics };
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent<AccountabilityUpdateDetail>(ACCOUNTABILITY_UPDATED_EVENT, { detail }));
  }
  const subs = listeners.get(address);
  if (!subs) return;
  subs.forEach((listener) => {
    try {
      listener(metrics);
    } catch {
      // A faulty listener must not break other subscribers.
    }
  });
}

/** Returns the current metrics for an address, or null if none have been recorded. */
export function getAccountabilityMetrics(address: string): AccountabilityMetrics | null {
  return metricsStore.get(normalizeAddress(address)) ?? null;
}

/**
 * Records an accountability event for a creator and notifies subscribers.
 * Returns the updated metrics.
 */
export function recordAccountabilityEvent(address: string, event: AccountabilityEvent): AccountabilityMetrics {
  const key = normalizeAddress(address);
  const current = metricsStore.get(key);
  const input: AccountabilityInput = current ? { ...current } : emptyInput();

  switch (event.type) {
    case "invoice_created":
      input.totalInvoices += 1;
      break;
    case "invoice_fulfilled":
      input.fulfilledInvoices += 1;
      break;
    case "invoice_cancelled":
      input.cancelledInvoices += 1;
      break;
    case "dispute_opened":
      input.disputes += 1;
      break;
    case "dispute_lost":
      input.disputesLost += 1;
      break;
    case "response_time": {
      const hours = Number.isFinite(event.hours) && event.hours >= 0 ? event.hours : 0;
      input.avgResponseHours = current
        ? (current.avgResponseHours + hours) / 2
        : hours;
      break;
    }
  }

  const metrics = buildMetrics(input);
  metricsStore.set(key, metrics);
  emitUpdate(key, metrics);
  return metrics;
}

/**
 * Subscribes to metric changes for a creator address. The listener is invoked
 * immediately with the current metrics (if any) and again on every update.
 * Returns an unsubscribe function.
 */
export function subscribeAccountabilityMetrics(
  address: string,
  listener: AccountabilityListener,
): () => void {
  const key = normalizeAddress(address);
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(listener);

  const existing = metricsStore.get(key);
  if (existing) {
    try {
      listener(existing);
    } catch {
      // Ignore listener errors on initial emit.
    }
  }

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(key);
  };
}
