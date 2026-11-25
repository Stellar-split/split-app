import {
  detectFraud,
  addRule,
  removeRule,
  listRules,
  getRule,
  getAlerts,
  clearAlerts,
  resetRulesToDefault,
  type Transaction,
  type FraudRule,
} from '@/lib/fraudDetectionEngine';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    amount: 100,
    currency: 'USD',
    senderId: 'sender-1',
    recipientId: 'recipient-1',
    timestamp: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  clearAlerts();
  resetRulesToDefault();
});

describe('fraudDetectionEngine', () => {
  describe('detection works', () => {
    it('flags a large transaction as suspicious', () => {
      const tx = makeTx({ amount: 15000 });
      const result = detectFraud(tx);
      expect(result.isSuspicious).toBe(true);
      expect(result.triggeredRules).toContain('large_amount');
    });

    it('does not flag a small normal transaction', () => {
      const tx = makeTx({ amount: 50 });
      const result = detectFraud(tx, { senderHistory: [], recipientHistory: [] });
      expect(result.isSuspicious).toBe(false);
      expect(result.triggeredRules).toHaveLength(0);
    });

    it('returns a transactionId matching the input', () => {
      const tx = makeTx({ id: 'my-tx-123' });
      const result = detectFraud(tx);
      expect(result.transactionId).toBe('my-tx-123');
    });
  });

  describe('scoring works', () => {
    it('assigns low risk score for clean transactions', () => {
      const tx = makeTx({ amount: 10 });
      const result = detectFraud(tx, { senderHistory: [], recipientHistory: [] });
      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe('low');
    });

    it('assigns medium risk for moderate signals', () => {
      const tx = makeTx({ amount: 7000 });
      const result = detectFraud(tx, { senderHistory: [], recipientHistory: [] });
      // new_recipient_large (35) → medium
      expect(result.riskLevel).toBe('medium');
    });

    it('assigns high risk for large amounts above threshold', () => {
      const tx = makeTx({ amount: 20000 });
      // large_amount (40) + new_recipient_large (35) = 75 → high
      const result = detectFraud(tx, { senderHistory: [], recipientHistory: [] });
      expect(result.riskLevel).toBe('high');
    });

    it('caps risk score at 100', () => {
      // Add a rule that returns 200 score
      addRule({
        id: 'extreme',
        name: 'Extreme',
        description: 'Returns 200',
        evaluate: () => ({ score: 200, message: 'extreme' }),
      });
      const result = detectFraud(makeTx());
      expect(result.riskScore).toBeLessThanOrEqual(100);
      removeRule('extreme');
    });
  });

  describe('rules work', () => {
    it('lists default rules', () => {
      const rules = listRules();
      expect(rules.length).toBeGreaterThanOrEqual(4);
      expect(rules.map((r) => r.id)).toContain('large_amount');
    });

    it('adds a custom rule', () => {
      const customRule: FraudRule = {
        id: 'custom_test',
        name: 'Custom Test Rule',
        description: 'Always fires',
        evaluate: () => ({ score: 50, message: 'custom fired' }),
      };
      addRule(customRule);
      expect(getRule('custom_test')).toBeDefined();
      const result = detectFraud(makeTx());
      expect(result.triggeredRules).toContain('custom_test');
    });

    it('removes a rule', () => {
      const removed = removeRule('large_amount');
      expect(removed).toBe(true);
      expect(getRule('large_amount')).toBeUndefined();
      const tx = makeTx({ amount: 50000 });
      const result = detectFraud(tx, { senderHistory: [], recipientHistory: [] });
      expect(result.triggeredRules).not.toContain('large_amount');
    });

    it('applies rapid succession rule', () => {
      const now = Date.now();
      const senderId = 'rapid-sender';
      const history: Transaction[] = Array.from({ length: 5 }, (_, i) => makeTx({ senderId, timestamp: now - i * 1000 }));
      const tx = makeTx({ senderId, timestamp: now });
      const result = detectFraud(tx, { senderHistory: history, recipientHistory: [] });
      expect(result.triggeredRules).toContain('rapid_succession');
    });
  });

  describe('alerts work', () => {
    it('generates alerts for high-score rule triggers', () => {
      const tx = makeTx({ amount: 15000 });
      const result = detectFraud(tx);
      expect(result.alerts.length).toBeGreaterThan(0);
    });

    it('stores alerts in the alert log', () => {
      clearAlerts();
      detectFraud(makeTx({ amount: 15000 }));
      expect(getAlerts().length).toBeGreaterThan(0);
    });

    it('alert contains transactionId and message', () => {
      const tx = makeTx({ id: 'alert-tx', amount: 20000 });
      const result = detectFraud(tx);
      const alert = result.alerts[0];
      expect(alert.transactionId).toBe('alert-tx');
      expect(alert.message).toBeTruthy();
    });

    it('clears alerts', () => {
      detectFraud(makeTx({ amount: 15000 }));
      clearAlerts();
      expect(getAlerts()).toHaveLength(0);
    });
  });
});
