"use client";

import { useMemo } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  check: (stats: CreatorStats) => boolean;
}

export interface CreatorStats {
  totalInvoices: number;
  releasedInvoices: number;
  totalVolumeUsdc: number;
  completionRate: number;
  reputationScore: number;
  uniquePayers: number;
  streakWeeks: number;
}

// ─── Badge catalogue ───────────────────────────────────────────────────────────

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-invoice",
    name: "First Invoice",
    description: "Created your very first invoice on StellarSplit.",
    icon: "🧾",
    tier: "bronze",
    check: (s) => s.totalInvoices >= 1,
  },
  {
    id: "invoice-10",
    name: "Invoice Veteran",
    description: "Sent 10 or more invoices.",
    icon: "📋",
    tier: "silver",
    check: (s) => s.totalInvoices >= 10,
  },
  {
    id: "invoice-50",
    name: "Invoice Pro",
    description: "Sent 50 or more invoices.",
    icon: "🏆",
    tier: "gold",
    check: (s) => s.totalInvoices >= 50,
  },
  {
    id: "invoice-100",
    name: "Invoice Legend",
    description: "Sent 100 or more invoices.",
    icon: "👑",
    tier: "platinum",
    check: (s) => s.totalInvoices >= 100,
  },
  {
    id: "volume-1k",
    name: "Rising Creator",
    description: "Raised over 1,000 USDC in total.",
    icon: "💸",
    tier: "bronze",
    check: (s) => s.totalVolumeUsdc >= 1000,
  },
  {
    id: "volume-10k",
    name: "Power Creator",
    description: "Raised over 10,000 USDC in total.",
    icon: "💰",
    tier: "silver",
    check: (s) => s.totalVolumeUsdc >= 10_000,
  },
  {
    id: "volume-100k",
    name: "Stellar Creator",
    description: "Raised over 100,000 USDC in total.",
    icon: "🌟",
    tier: "gold",
    check: (s) => s.totalVolumeUsdc >= 100_000,
  },
  {
    id: "completion-50",
    name: "Consistent Closer",
    description: "Achieved a 50%+ invoice completion rate.",
    icon: "✅",
    tier: "bronze",
    check: (s) => s.completionRate >= 50,
  },
  {
    id: "completion-80",
    name: "High Performer",
    description: "Achieved an 80%+ invoice completion rate.",
    icon: "🎯",
    tier: "silver",
    check: (s) => s.completionRate >= 80,
  },
  {
    id: "completion-100",
    name: "Perfect Record",
    description: "100% invoice completion rate (min 5 invoices).",
    icon: "💎",
    tier: "platinum",
    check: (s) => s.completionRate === 100 && s.totalInvoices >= 5,
  },
  {
    id: "rep-50",
    name: "Trusted Creator",
    description: "Reached a reputation score of 50+.",
    icon: "🔒",
    tier: "bronze",
    check: (s) => s.reputationScore >= 50,
  },
  {
    id: "rep-80",
    name: "Highly Trusted",
    description: "Reached a reputation score of 80+.",
    icon: "🛡️",
    tier: "silver",
    check: (s) => s.reputationScore >= 80,
  },
  {
    id: "rep-100",
    name: "Verified Legend",
    description: "Perfect on-chain reputation score of 100.",
    icon: "🌐",
    tier: "platinum",
    check: (s) => s.reputationScore >= 100,
  },
  {
    id: "payers-10",
    name: "Community Builder",
    description: "Received payments from 10+ unique payers.",
    icon: "👥",
    tier: "bronze",
    check: (s) => s.uniquePayers >= 10,
  },
  {
    id: "payers-50",
    name: "Community Leader",
    description: "Received payments from 50+ unique payers.",
    icon: "🌍",
    tier: "silver",
    check: (s) => s.uniquePayers >= 50,
  },
  {
    id: "streak-4",
    name: "On a Roll",
    description: "Created invoices for 4 consecutive weeks.",
    icon: "🔥",
    tier: "bronze",
    check: (s) => s.streakWeeks >= 4,
  },
  {
    id: "streak-12",
    name: "Momentum Master",
    description: "Created invoices for 12 consecutive weeks.",
    icon: "⚡",
    tier: "gold",
    check: (s) => s.streakWeeks >= 12,
  },
];

// ─── Styles ────────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<BadgeTier, { ring: string; bg: string; label: string; text: string }> = {
  bronze: {
    ring: "ring-amber-700/60",
    bg: "bg-amber-900/20",
    label: "bg-amber-700/30 text-amber-400",
    text: "text-amber-400",
  },
  silver: {
    ring: "ring-gray-400/60",
    bg: "bg-gray-700/30",
    label: "bg-gray-600/30 text-gray-300",
    text: "text-gray-300",
  },
  gold: {
    ring: "ring-yellow-500/60",
    bg: "bg-yellow-900/20",
    label: "bg-yellow-700/30 text-yellow-400",
    text: "text-yellow-400",
  },
  platinum: {
    ring: "ring-indigo-400/60",
    bg: "bg-indigo-900/20",
    label: "bg-indigo-700/30 text-indigo-300",
    text: "text-indigo-300",
  },
};

// ─── BadgeCard ─────────────────────────────────────────────────────────────────

function BadgeCard({ badge, earned }: { badge: BadgeDefinition; earned: boolean }) {
  const s = TIER_STYLES[badge.tier];
  return (
    <div
      title={badge.description}
      className={`relative flex flex-col items-center gap-1.5 rounded-xl p-3 border transition-all ${
        earned
          ? `ring-2 ${s.ring} ${s.bg} border-transparent`
          : "border-gray-800 bg-gray-900/40 opacity-40 grayscale"
      }`}
      aria-label={`${badge.name}${earned ? " — earned" : " — locked"}`}
    >
      <span className="text-2xl" aria-hidden="true">{badge.icon}</span>
      <p className={`text-xs font-semibold text-center leading-tight ${earned ? s.text : "text-gray-600"}`}>
        {badge.name}
      </p>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${earned ? s.label : "bg-gray-800 text-gray-600"}`}>
        {badge.tier}
      </span>
      {!earned && (
        <span className="absolute top-1.5 right-1.5 text-[10px] text-gray-700" aria-hidden="true">🔒</span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  stats: CreatorStats;
  showLocked?: boolean;
}

export default function CreatorBadges({ stats, showLocked = true }: Props) {
  const { earned, locked } = useMemo(() => {
    const earned: BadgeDefinition[] = [];
    const locked: BadgeDefinition[] = [];
    for (const b of BADGE_DEFINITIONS) {
      (b.check(stats) ? earned : locked).push(b);
    }
    return { earned, locked };
  }, [stats]);

  const tierCounts = useMemo(() => {
    const counts: Record<BadgeTier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    earned.forEach((b) => counts[b.tier]++);
    return counts;
  }, [earned]);

  return (
    <section aria-labelledby="badges-heading" className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="badges-heading" className="text-base font-semibold text-white">
            Badges &amp; Achievements
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {earned.length} of {BADGE_DEFINITIONS.length} earned
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["platinum", "gold", "silver", "bronze"] as BadgeTier[]).map((tier) =>
            tierCounts[tier] > 0 ? (
              <span key={tier} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TIER_STYLES[tier].label}`}>
                {tierCounts[tier]} {tier}
              </span>
            ) : null
          )}
        </div>
      </div>

      {earned.length === 0 && (
        <p className="text-sm text-gray-500 mb-4">
          No badges earned yet — keep creating and completing invoices!
        </p>
      )}

      {earned.length > 0 && (
        <div className="mb-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Earned</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {earned.map((b) => <BadgeCard key={b.id} badge={b} earned />)}
          </div>
        </div>
      )}

      {showLocked && locked.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Locked</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {locked.map((b) => <BadgeCard key={b.id} badge={b} earned={false} />)}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div className="mt-4 p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
          <p className="text-xs text-indigo-300 font-medium mb-0.5">
            Next up: {locked[0].icon} {locked[0].name}
          </p>
          <p className="text-xs text-gray-500">{locked[0].description}</p>
        </div>
      )}
    </section>
  );
}

// ─── Utility: derive stats from invoice data ───────────────────────────────────

export function deriveCreatorStats(
  invoices: {
    status: string;
    funded: bigint;
    payments: { payer: string }[];
    createdAt?: number;
    deadline: number;
  }[],
  reputationScore: number
): CreatorStats {
  const STROOPS = 10_000_000;
  const totalInvoices = invoices.length;
  const released = invoices.filter((i) => i.status === "Released");
  const totalVolumeUsdc = released.reduce((s, i) => s + Number(i.funded) / STROOPS, 0);
  const completionRate = totalInvoices > 0 ? Math.round((released.length / totalInvoices) * 100) : 0;
  const uniquePayers = new Set(invoices.flatMap((i) => i.payments.map((p) => p.payer))).size;

  const weekKey = (ts: number) => {
    const d = new Date(ts * 1000);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().split("T")[0];
  };
  const weeksWithInvoices = new Set(
    invoices.map((i) => weekKey(i.createdAt ?? i.deadline - 7 * 86400))
  );
  let streakWeeks = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (weeksWithInvoices.has(monday.toISOString().split("T")[0])) streakWeeks++;
    else break;
  }

  return {
    totalInvoices,
    releasedInvoices: released.length,
    totalVolumeUsdc,
    completionRate,
    reputationScore,
    uniquePayers,
    streakWeeks,
  };
}
