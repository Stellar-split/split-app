export interface ActivityEvent {
  id: string;
  actor: string;
  amount: number;
  timestamp: number;
}

export type AlertSeverity = "low" | "medium" | "high";
export type AlertRule = "velocity" | "amount_spike" | "repeated_amount";

export interface SuspiciousActivityAlert {
  id: string;
  rule: AlertRule;
  severity: AlertSeverity;
  actor: string;
  message: string;
  eventIds: string[];
}

export interface DetectionOptions {
  /** Max events per actor inside `velocityWindowMs` before flagging. */
  velocityLimit?: number;
  velocityWindowMs?: number;
  /** Amount above `spikeMultiplier` × median of all events is flagged. */
  spikeMultiplier?: number;
  /** Same actor sending the same amount this many times is flagged. */
  repeatLimit?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function detectSuspiciousActivity(
  events: ActivityEvent[],
  { velocityLimit = 5, velocityWindowMs = 60_000, spikeMultiplier = 10, repeatLimit = 3 }: DetectionOptions = {},
): SuspiciousActivityAlert[] {
  const alerts: SuspiciousActivityAlert[] = [];
  const byActor = new Map<string, ActivityEvent[]>();
  for (const e of events) byActor.set(e.actor, [...(byActor.get(e.actor) ?? []), e]);

  byActor.forEach((list, actor) => {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
    for (let start = 0, end = 0; end < sorted.length; end++) {
      while (sorted[end].timestamp - sorted[start].timestamp > velocityWindowMs) start++;
      if (end - start + 1 > velocityLimit) {
        const burst = sorted.slice(start, end + 1);
        alerts.push({
          id: `velocity-${actor}`,
          rule: "velocity",
          severity: "high",
          actor,
          message: `${burst.length} transactions within ${Math.round(velocityWindowMs / 1000)}s`,
          eventIds: burst.map((e) => e.id),
        });
        break;
      }
    }

    const counts = new Map<number, ActivityEvent[]>();
    for (const e of list) counts.set(e.amount, [...(counts.get(e.amount) ?? []), e]);
    counts.forEach((same, amount) => {
      if (same.length >= repeatLimit) {
        alerts.push({
          id: `repeated-${actor}-${amount}`,
          rule: "repeated_amount",
          severity: "low",
          actor,
          message: `Same amount (${amount}) sent ${same.length} times`,
          eventIds: same.map((e) => e.id),
        });
      }
    });
  });

  const baseline = median(events.map((e) => e.amount));
  if (baseline > 0) {
    for (const e of events) {
      if (e.amount > baseline * spikeMultiplier) {
        alerts.push({
          id: `spike-${e.id}`,
          rule: "amount_spike",
          severity: "medium",
          actor: e.actor,
          message: `Amount ${e.amount} is over ${spikeMultiplier}× the typical ${baseline}`,
          eventIds: [e.id],
        });
      }
    }
  }

  const rank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
