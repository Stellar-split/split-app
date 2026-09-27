export type RiskLevel = "low" | "medium" | "high";

export interface RiskInput {
  /** Total invoice amount in whole units. */
  amount: number;
  recipientCount: number;
  /** Age of the creator account in days. */
  creatorAccountAgeDays: number;
  /** Number of invoices previously disputed by this creator. */
  priorDisputes: number;
  /** Days until the invoice deadline. */
  deadlineDays: number;
  isPrivate?: boolean;
}

export interface RiskFactor {
  id: string;
  label: string;
  points: number;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export function assessInvoiceRisk(input: RiskInput): RiskAssessment {
  const factors: RiskFactor[] = [];
  if (input.amount >= 10_000) factors.push({ id: "large-amount", label: "Large invoice amount", points: 30 });
  else if (input.amount >= 1_000) factors.push({ id: "medium-amount", label: "Elevated invoice amount", points: 10 });
  if (input.creatorAccountAgeDays < 7) factors.push({ id: "new-account", label: "Creator account under 7 days old", points: 25 });
  else if (input.creatorAccountAgeDays < 30) factors.push({ id: "young-account", label: "Creator account under 30 days old", points: 10 });
  if (input.priorDisputes > 0)
    factors.push({ id: "disputes", label: `${input.priorDisputes} prior dispute(s)`, points: Math.min(input.priorDisputes * 15, 30) });
  if (input.deadlineDays < 1) factors.push({ id: "rushed-deadline", label: "Deadline under 24 hours", points: 15 });
  if (input.recipientCount > 20) factors.push({ id: "many-recipients", label: "More than 20 recipients", points: 10 });
  if (input.isPrivate) factors.push({ id: "private", label: "Private invoice", points: 5 });

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  const level: RiskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level, factors };
}
