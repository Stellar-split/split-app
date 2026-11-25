import { getTrustBadges, getTrustTier, type CreatorProfile, type TrustTier } from "@/lib/creatorVerification";

const TIER_STYLES: Record<TrustTier, string> = {
  unverified: "bg-gray-100 text-gray-700",
  verified: "bg-blue-100 text-blue-800",
  trusted: "bg-green-100 text-green-800",
};

export default function CreatorTrustBadges({ profile }: { profile: CreatorProfile }) {
  const tier = getTrustTier(profile);
  const badges = getTrustBadges(profile);
  return (
    <div aria-label="Creator trust signals" className="flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_STYLES[tier]}`}>{tier}</span>
      {badges.map((b) => (
        <span key={b.id} className="rounded-full border px-2.5 py-0.5 text-xs text-gray-700">
          ✓ {b.label}
        </span>
      ))}
    </div>
  );
}
