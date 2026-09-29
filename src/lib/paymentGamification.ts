export interface PaymentEvent {
  invoiceId: string;
  amount: number;
  paidAt: string;
  /** True when the payment landed before the invoice deadline. */
  onTime?: boolean;
}

export interface Level {
  level: number;
  name: string;
  minPoints: number;
}

export interface BadgeDefinition {
  id: string;
  label: string;
  description: string;
}

export interface Badge extends BadgeDefinition {
  earned: boolean;
}

export interface GamificationSummary {
  points: number;
  level: Level;
  nextLevel: Level | null;
  /** 0..1 progress through the current level towards the next one. */
  levelProgress: number;
  /** Consecutive calendar days (UTC) ending at the latest payment day. */
  streakDays: number;
  paymentCount: number;
  badges: Badge[];
}

export const LEVELS: Level[] = [
  { level: 1, name: "Starter", minPoints: 0 },
  { level: 2, name: "Contributor", minPoints: 50 },
  { level: 3, name: "Supporter", minPoints: 150 },
  { level: 4, name: "Champion", minPoints: 400 },
  { level: 5, name: "Legend", minPoints: 1000 },
];

export const BADGES: BadgeDefinition[] = [
  { id: "first-payment", label: "First payment", description: "Paid your first invoice." },
  { id: "five-payments", label: "Regular", description: "Paid five invoices." },
  { id: "on-time-3", label: "Punctual", description: "Paid three invoices on time." },
  { id: "streak-3", label: "On a roll", description: "Paid on three consecutive days." },
  { id: "big-spender", label: "Big spender", description: "Paid 1,000 or more in total." },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_POINTS = 10;
const ON_TIME_BONUS = 5;
const MAX_AMOUNT_BONUS = 20;

/** 10 base points, +5 when on time, plus 1 per 10 units paid (capped at 20). */
export function pointsForPayment(event: PaymentEvent): number {
  const amountBonus = Math.min(MAX_AMOUNT_BONUS, Math.floor(Math.max(0, event.amount) / 10));
  return BASE_POINTS + (event.onTime ? ON_TIME_BONUS : 0) + amountBonus;
}

export function levelForPoints(points: number): Level {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (points >= l.minPoints) current = l;
  }
  return current;
}

function dayNumber(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
}

export function paymentStreakDays(events: PaymentEvent[]): number {
  const days = Array.from(
    new Set(events.map((e) => dayNumber(e.paidAt)).filter((d): d is number => d !== null)),
  ).sort((a, b) => b - a);
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] !== 1) break;
    streak++;
  }
  return streak;
}

export function computeGamification(events: PaymentEvent[]): GamificationSummary {
  const points = events.reduce((sum, e) => sum + pointsForPayment(e), 0);
  const level = levelForPoints(points);
  const nextLevel = LEVELS.find((l) => l.minPoints > level.minPoints) ?? null;
  const levelProgress = nextLevel
    ? (points - level.minPoints) / (nextLevel.minPoints - level.minPoints)
    : 1;
  const streakDays = paymentStreakDays(events);
  const total = events.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
  const onTimeCount = events.filter((e) => e.onTime).length;

  const earned: Record<string, boolean> = {
    "first-payment": events.length >= 1,
    "five-payments": events.length >= 5,
    "on-time-3": onTimeCount >= 3,
    "streak-3": streakDays >= 3,
    "big-spender": total >= 1000,
  };

  return {
    points,
    level,
    nextLevel,
    levelProgress,
    streakDays,
    paymentCount: events.length,
    badges: BADGES.map((b) => ({ ...b, earned: earned[b.id] ?? false })),
  };
}
