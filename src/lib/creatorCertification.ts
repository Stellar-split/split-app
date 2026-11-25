export interface CertificationInput {
  walletVerified: boolean;
  kycVerified: boolean;
  accountAgeDays: number;
  completedInvoices: number;
  disputeRate: number; // 0-1
  onTimeRate: number; // 0-1 share of invoices fulfilled on time
}

export type CertificationTier = "bronze" | "silver" | "gold";
export type CertificationLevel = "none" | CertificationTier;

export interface CertificationRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface CertificationResult {
  level: CertificationLevel;
  next: CertificationTier | null;
  /** Requirements for the next tier (or for the top tier once it is reached). */
  requirements: CertificationRequirement[];
  /** Share of `requirements` that are met, 0-1. */
  progress: number;
}

const TIERS: { tier: CertificationTier; requirements: (i: CertificationInput) => CertificationRequirement[] }[] = [
  {
    tier: "bronze",
    requirements: (i) => [
      { id: "wallet", label: "Verify your wallet", met: i.walletVerified },
      { id: "invoices", label: "Complete 3 invoices", met: i.completedInvoices >= 3 },
      { id: "disputes", label: "Keep your dispute rate under 20%", met: i.disputeRate < 0.2 },
    ],
  },
  {
    tier: "silver",
    requirements: (i) => [
      { id: "kyc", label: "Verify your identity", met: i.kycVerified },
      { id: "invoices", label: "Complete 15 invoices", met: i.completedInvoices >= 15 },
      { id: "age", label: "Have an account at least 90 days old", met: i.accountAgeDays >= 90 },
      { id: "disputes", label: "Keep your dispute rate under 10%", met: i.disputeRate < 0.1 },
    ],
  },
  {
    tier: "gold",
    requirements: (i) => [
      { id: "invoices", label: "Complete 50 invoices", met: i.completedInvoices >= 50 },
      { id: "age", label: "Have an account at least 1 year old", met: i.accountAgeDays >= 365 },
      { id: "disputes", label: "Keep your dispute rate under 5%", met: i.disputeRate < 0.05 },
      { id: "on-time", label: "Fulfil at least 90% of invoices on time", met: i.onTimeRate >= 0.9 },
    ],
  },
];

/** A tier is only awarded once every lower tier's requirements are also met. */
export function evaluateCertification(input: CertificationInput): CertificationResult {
  let level: CertificationLevel = "none";
  for (const { tier, requirements } of TIERS) {
    const reqs = requirements(input);
    if (reqs.every((r) => r.met)) {
      level = tier;
      continue;
    }
    return { level, next: tier, requirements: reqs, progress: reqs.filter((r) => r.met).length / reqs.length };
  }
  const top = TIERS[TIERS.length - 1].requirements(input);
  return { level, next: null, requirements: top, progress: 1 };
}
