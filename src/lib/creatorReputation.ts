/**
 * Creator reputation and trust scoring.
 *
 * Computes a 0-100 reputation score for a creator based on reliability
 * metrics (on-time payment rate, completion rate, dispute rate, and
 * responsiveness), derives a trust tier and badges, and provides an
 * in-memory (optionally localStorage-backed) appeal store.
 */

import {
  gradeForScore,
  MIN_INVOICES_FOR_SCORE,
  type Grade,
} from './creatorAccountability';
import {
  getTrustBadges,
  getTrustTier,
  type TrustBadge,
  type TrustTier,
} from './creatorVerification';

export { MIN_INVOICES_FOR_SCORE };
export type { Grade, TrustBadge, TrustTier };

/** Raw metrics used to compute a creator's reputation. */
export interface CreatorReputationInput {
  /** Total number of invoices ever issued to this creator. */
  totalInvoices: number;
  /** Invoices that were fulfilled (paid or otherwise settled). */
  fulfilledInvoices: number;
  /** Invoices fulfilled on or before their due date. */
  onTimeInvoices: number;
  /** Invoices cancelled before fulfillment. */
  cancelledInvoices: number;
  /** Total number of disputes raised against this creator. */
  disputes: number;
  /** Disputes that were resolved against the creator. */
  disputesLost: number;
  /** Average response time to invoice-related messages, in hours. */
  avgResponseHours: number;
  /** Age of the creator account, in days. */
  accountAgeDays: number;
  /** Invoices that were fully completed (delivered and paid). */
  completedInvoices: number;
}

/** Component scores (each 0-100) that make up the final reputation score. */
export interface CreatorReputationBreakdown {
  /** On-time payment rate component (weight 35). */
  onTime: number;
  /** Completion rate component (weight 25). */
  completion: number;
  /** Dispute rate component (weight 25). */
  disputes: number;
  /** Responsiveness component (weight 15). */
  responsiveness: number;
}

/** Result of computing a creator's reputation. */
export interface CreatorReputationResult {
  /** Overall score 0-100, or null when there is insufficient history. */
  score: number | null;
  /** Letter grade derived from the score, or null when unscored. */
  grade: Grade | null;
  /** Per-component breakdown of the score. */
  breakdown: CreatorReputationBreakdown;
  /** Trust tier derived from the creator's verification state. */
  trustTier: TrustTier;
  /** Trust badges derived from the creator's verification state. */
  badges: TrustBadge[];
}

/** Weights for each score component. Must sum to 100. */
export const REPUTATION_WEIGHTS = {
  onTime: 35,
  completion: 25,
  disputes: 25,
  responsiveness: 15,
} as const;

/** Response time (hours) at or below which responsiveness scores 100. */
const RESPONSIVENESS_BEST_HOURS = 2;
/** Response time (hours) at or above which responsiveness scores 0. */
const RESPONSIVENESS_WORST_HOURS = 72;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return clamp(numerator / denominator, 0, 1);
}

/**
 * Compute the on-time payment component (0-100).
 * Ratio of on-time invoices to fulfilled invoices.
 */
function computeOnTimeScore(input: CreatorReputationInput): number {
  return safeRatio(input.onTimeInvoices, input.fulfilledInvoices) * 100;
}

/**
 * Compute the completion component (0-100).
 * Ratio of completed invoices to total invoices.
 */
function computeCompletionScore(input: CreatorReputationInput): number {
  return safeRatio(input.completedInvoices, input.totalInvoices) * 100;
}

/**
 * Compute the dispute component (0-100).
 * A lower dispute rate yields a higher score. Lost disputes count double.
 * The effective dispute count is compared against total invoices.
 */
function computeDisputeScore(input: CreatorReputationInput): number {
  const total = input.totalInvoices;
  if (total <= 0) return 100;

  const won = Math.max(0, input.disputes - input.disputesLost);
  const lost = Math.max(0, input.disputesLost);
  const effectiveDisputes = won + lost * 2;

  const disputeRate = clamp(effectiveDisputes / total, 0, 1);
  return (1 - disputeRate) * 100;
}

/**
 * Compute the responsiveness component (0-100).
 * Faster average response times yield higher scores.
 */
function computeResponsivenessScore(input: CreatorReputationInput): number {
  const hours = input.avgResponseHours;
  if (!Number.isFinite(hours) || hours <= RESPONSIVENESS_BEST_HOURS) return 100;
  if (hours >= RESPONSIVENESS_WORST_HOURS) return 0;

  const span = RESPONSIVENESS_WORST_HOURS - RESPONSIVENESS_BEST_HOURS;
  const over = hours - RESPONSIVENESS_BEST_HOURS;
  return clamp((1 - over / span) * 100, 0, 100);
}

/**
 * Compute a creator's reputation from raw metrics.
 *
 * The final score is a weighted sum of four components:
 * - on-time payment rate (35)
 * - completion rate (25)
 * - dispute rate (25, lost disputes count double)
 * - responsiveness (15)
 *
 * Returns a null score when the creator has fewer than
 * MIN_INVOICES_FOR_SCORE total invoices.
 */
export function computeCreatorReputation(
  input: CreatorReputationInput,
): CreatorReputationResult {
  const breakdown: CreatorReputationBreakdown = {
    onTime: computeOnTimeScore(input),
    completion: computeCompletionScore(input),
    disputes: computeDisputeScore(input),
    responsiveness: computeResponsivenessScore(input),
  };

  const trustTier = getTrustTier(input);
  const badges = getTrustBadges(input);

  if (input.totalInvoices < MIN_INVOICES_FOR_SCORE) {
    return {
      score: null,
      grade: null,
      breakdown,
      trustTier,
      badges,
    };
  }

  const weighted =
    (breakdown.onTime * REPUTATION_WEIGHTS.onTime +
      breakdown.completion * REPUTATION_WEIGHTS.completion +
      breakdown.disputes * REPUTATION_WEIGHTS.disputes +
      breakdown.responsiveness * REPUTATION_WEIGHTS.responsiveness) /
    100;

  const score = Math.round(clamp(weighted, 0, 100));

  return {
    score,
    grade: gradeForScore(score),
    breakdown,
    trustTier,
    badges,
  };
}

/** Status of a reputation appeal. */
export type ReputationAppealStatus = 'pending' | 'approved' | 'rejected';

/** A creator's appeal against their reputation score. */
export interface ReputationAppeal {
  id: string;
  creatorAddress: string;
  reason: string;
  status: ReputationAppealStatus;
  submittedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

const APPEAL_STORAGE_KEY = 'creatorReputation.appeals.v1';

let appealStore: ReputationAppeal[] = loadAppeals();

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function loadAppeals(): ReputationAppeal[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(APPEAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ReputationAppeal =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.creatorAddress === 'string',
    );
  } catch {
    return [];
  }
}

function persistAppeals(): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(APPEAL_STORAGE_KEY, JSON.stringify(appealStore));
  } catch {
    // Ignore persistence failures (quota, privacy mode, etc.).
  }
}

function generateAppealId(): string {
  const cryptoObj =
    typeof crypto !== 'undefined' ? (crypto as Crypto) : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `appeal_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Submit a new reputation appeal for a creator.
 * Returns the created appeal record.
 */
export function submitReputationAppeal(
  creatorAddress: string,
  reason: string,
): ReputationAppeal {
  const appeal: ReputationAppeal = {
    id: generateAppealId(),
    creatorAddress,
    reason,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    resolvedAt: null,
    resolutionNote: null,
  };
  appealStore = [...appealStore, appeal];
  persistAppeals();
  return appeal;
}

/** List all appeals for a given creator, newest first. */
export function listAppealsForCreator(creatorAddress: string): ReputationAppeal[] {
  return appealStore
    .filter((appeal) => appeal.creatorAddress === creatorAddress)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/**
 * Resolve a pending appeal.
 * Returns the updated appeal, or null if no matching appeal exists.
 */
export function resolveAppeal(
  id: string,
  status: Exclude<ReputationAppealStatus, 'pending'>,
  resolutionNote: string | null = null,
): ReputationAppeal | null {
  const index = appealStore.findIndex((appeal) => appeal.id === id);
  if (index === -1) return null;

  const updated: ReputationAppeal = {
    ...appealStore[index],
    status,
    resolvedAt: new Date().toISOString(),
    resolutionNote,
  };

  appealStore = [
    ...appealStore.slice(0, index),
    updated,
    ...appealStore.slice(index + 1),
  ];
  persistAppeals();
  return updated;
}