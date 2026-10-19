"use client";

import { useCreatorReputation } from "@/hooks/useCreatorReputation";
import type { CreatorReputationResult } from "@/lib/reputation";

interface Props {
  address: string;
  reputation?: CreatorReputationResult;
}

export default function ReputationBadge({ address, reputation }: Props) {
  const { data: fetchedReputation, loading } = useCreatorReputation(address);
  const result = reputation ?? fetchedReputation;

  if (loading && !result) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">
        ⏳
      </span>
    );
  }

  const score = result?.score ?? null;
  const isUnrated = score === null;
  const grade = result?.grade ?? null;
  const tier = result?.tier ?? null;

  const tooltipText =
    "Reputation is calculated from on-time payments, dispute win rate, " +
    "and total transaction volume. Consistent, timely activity raises your score.";

  const badgeLabel = isUnrated
    ? "Unrated"
    : `${score}${grade ? ` · ${grade}` : ""}${tier ? ` · ${tier}` : ""}`;

  const ariaLabel = isUnrated
    ? `Reputation: unrated. ${tooltipText}`
    : `Reputation: ${score}${grade ? `, grade ${grade}` : ""}${
        tier ? `, ${tier} tier` : ""
      }. ${tooltipText}`;

  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full cursor-default focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          isUnrated
            ? "bg-gray-700 text-gray-400"
            : "bg-green-900 text-green-300"
        }`}
      >
        {isUnrated ? "○" : "✓"}
        <span>{badgeLabel}</span>
      </span>
      {/* Tooltip: shown on hover and keyboard focus */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden w-56 rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-200 shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="block font-semibold mb-0.5">
          {isUnrated ? "Reputation: Unrated" : `Reputation: ${score}`}
        </span>
        {!isUnrated && (grade || tier) && (
          <span className="block mb-0.5">
            {grade ? `Grade: ${grade}` : ""}
            {grade && tier ? " · " : ""}
            {tier ? `Tier: ${tier}` : ""}
          </span>
        )}
        {tooltipText}
      </span>
    </span>
  );
}
