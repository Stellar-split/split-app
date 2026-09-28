export interface CreatorProfile {
  emailVerified: boolean;
  walletVerified: boolean;
  kycVerified: boolean;
  accountAgeDays: number;
  completedInvoices: number;
  disputeRate: number; // 0-1
}

export type BadgeId = "email" | "wallet" | "kyc" | "established" | "reliable";

export interface TrustBadge {
  id: BadgeId;
  label: string;
}

export type TrustTier = "unverified" | "verified" | "trusted";

export function getTrustBadges(p: CreatorProfile): TrustBadge[] {
  const badges: TrustBadge[] = [];
  if (p.emailVerified) badges.push({ id: "email", label: "Email verified" });
  if (p.walletVerified) badges.push({ id: "wallet", label: "Wallet verified" });
  if (p.kycVerified) badges.push({ id: "kyc", label: "Identity verified" });
  if (p.accountAgeDays >= 180) badges.push({ id: "established", label: "Established creator" });
  if (p.completedInvoices >= 10 && p.disputeRate < 0.05) badges.push({ id: "reliable", label: "Reliable payer history" });
  return badges;
}

export function getTrustTier(p: CreatorProfile): TrustTier {
  if (!p.walletVerified) return "unverified";
  const ids = getTrustBadges(p).map((b) => b.id);
  return ids.includes("kyc") && ids.includes("reliable") ? "trusted" : "verified";
}
