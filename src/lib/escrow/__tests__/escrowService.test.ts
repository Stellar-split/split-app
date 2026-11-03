import { describe, it, expect } from 'vitest';
import { EscrowService } from '../escrowService';

describe('EscrowService End-to-End Integration', () => {
  it('produces aggregated analytics report', () => {
    const service = new EscrowService();
    const analytics = service.getAnalytics();
    expect(analytics.summary.totalEscrows).toBe(0);
    expect(analytics.summary.totalValueReleased).toBe(0n);
    expect(analytics.summary.totalValueLocked).toBe(0n);
  });
});
