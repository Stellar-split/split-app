/**
 * Fraud Detection Engine (#1172)
 *
 * Detects suspicious transactions, applies risk scoring, supports a rules engine,
 * and generates alerts.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  senderId: string;
  recipientId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DetectionResult {
  transactionId: string;
  riskScore: number;        // 0–100
  riskLevel: RiskLevel;
  triggeredRules: string[];
  alerts: FraudAlert[];
  isSuspicious: boolean;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  riskLevel: RiskLevel;
  message: string;
  createdAt: number;
  triggeredBy: string;
}

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  /** Returns a risk contribution 0–100 and an optional message if triggered; 0 / undefined means not triggered. */
  evaluate: (tx: Transaction, context: RuleContext) => { score: number; message?: string };
}

export interface RuleContext {
  senderHistory: Transaction[];
  recipientHistory: Transaction[];
}

// ─── Default rules ────────────────────────────────────────────────────────────

const LARGE_AMOUNT_RULE: FraudRule = {
  id: 'large_amount',
  name: 'Large Amount',
  description: 'Flags transactions above $10,000',
  evaluate: (tx) => {
    if (tx.amount > 10000) return { score: 40, message: `Large transaction: $${tx.amount}` };
    return { score: 0 };
  },
};

const RAPID_SUCCESSION_RULE: FraudRule = {
  id: 'rapid_succession',
  name: 'Rapid Succession',
  description: 'Flags >5 transactions from same sender within 60 seconds',
  evaluate: (tx, ctx) => {
    const window = 60_000;
    const recent = ctx.senderHistory.filter(
      (t) => t.senderId === tx.senderId && Math.abs(t.timestamp - tx.timestamp) <= window && t.id !== tx.id,
    );
    if (recent.length >= 5) {
      return { score: 50, message: `Rapid succession: ${recent.length + 1} transactions within 60s` };
    }
    return { score: 0 };
  },
};

const NEW_RECIPIENT_LARGE_RULE: FraudRule = {
  id: 'new_recipient_large',
  name: 'New Recipient Large Payment',
  description: 'Flags large payments to recipients with no prior history',
  evaluate: (tx, ctx) => {
    if (tx.amount > 5000 && ctx.recipientHistory.length === 0) {
      return { score: 35, message: `Large payment ($${tx.amount}) to new recipient` };
    }
    return { score: 0 };
  },
};

const UNUSUAL_HOURS_RULE: FraudRule = {
  id: 'unusual_hours',
  name: 'Unusual Hours',
  description: 'Flags transactions between 1am–5am UTC',
  evaluate: (tx) => {
    const hour = new Date(tx.timestamp).getUTCHours();
    if (hour >= 1 && hour < 5) {
      return { score: 20, message: `Transaction at unusual hour: ${hour}:00 UTC` };
    }
    return { score: 0 };
  },
};

// ─── Engine state ─────────────────────────────────────────────────────────────

const rules = new Map<string, FraudRule>([
  [LARGE_AMOUNT_RULE.id, LARGE_AMOUNT_RULE],
  [RAPID_SUCCESSION_RULE.id, RAPID_SUCCESSION_RULE],
  [NEW_RECIPIENT_LARGE_RULE.id, NEW_RECIPIENT_LARGE_RULE],
  [UNUSUAL_HOURS_RULE.id, UNUSUAL_HOURS_RULE],
]);

const alertLog: FraudAlert[] = [];
let _alertCounter = 0;

function generateAlertId(): string {
  return `alert-${Date.now()}-${++_alertCounter}`;
}

// ─── Rules management ─────────────────────────────────────────────────────────

/** Add or replace a rule. */
export function addRule(rule: FraudRule): void {
  rules.set(rule.id, rule);
}

/** Remove a rule by ID. */
export function removeRule(id: string): boolean {
  return rules.delete(id);
}

/** List all active rules. */
export function listRules(): FraudRule[] {
  return Array.from(rules.values());
}

/** Get a specific rule. */
export function getRule(id: string): FraudRule | undefined {
  return rules.get(id);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Analyze a transaction against all active rules.
 */
export function detectFraud(tx: Transaction, context: RuleContext = { senderHistory: [], recipientHistory: [] }): DetectionResult {
  const triggeredRules: string[] = [];
  const alerts: FraudAlert[] = [];
  let totalScore = 0;

  for (const rule of rules.values()) {
    const result = rule.evaluate(tx, context);
    if (result.score > 0) {
      triggeredRules.push(rule.id);
      totalScore += result.score;

      // Create alert for significant contributions
      if (result.score >= 20) {
        const level = scoreToLevel(result.score);
        const alert: FraudAlert = {
          id: generateAlertId(),
          transactionId: tx.id,
          riskLevel: level,
          message: result.message ?? rule.description,
          createdAt: Date.now(),
          triggeredBy: rule.id,
        };
        alerts.push(alert);
        alertLog.push(alert);
      }
    }
  }

  // Cap at 100
  const riskScore = Math.min(100, totalScore);
  const riskLevel = scoreToLevel(riskScore);

  return {
    transactionId: tx.id,
    riskScore,
    riskLevel,
    triggeredRules,
    alerts,
    isSuspicious: riskScore >= 35,
  };
}

/** Get all generated alerts. */
export function getAlerts(): FraudAlert[] {
  return [...alertLog];
}

/** Clear alert log (for testing). */
export function clearAlerts(): void {
  alertLog.length = 0;
}

/** Reset rules to defaults (for testing). */
export function resetRulesToDefault(): void {
  rules.clear();
  rules.set(LARGE_AMOUNT_RULE.id, LARGE_AMOUNT_RULE);
  rules.set(RAPID_SUCCESSION_RULE.id, RAPID_SUCCESSION_RULE);
  rules.set(NEW_RECIPIENT_LARGE_RULE.id, NEW_RECIPIENT_LARGE_RULE);
  rules.set(UNUSUAL_HOURS_RULE.id, UNUSUAL_HOURS_RULE);
}
