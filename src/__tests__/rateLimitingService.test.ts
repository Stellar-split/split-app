import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPolicy,
  removePolicy,
  checkLimit,
  getQuota,
  generateReport,
  resetQuota,
  resetAll,
} from '@/services/rateLimitingService';
import type { RateLimitPolicy } from '@/services/rateLimitingService';

beforeEach(() => {
  resetAll();
});

describe('rateLimitingService', () => {
  describe('registerPolicy / removePolicy', () => {
    it('registers a policy and allows checks', () => {
      const policy: RateLimitPolicy = {
        id: 'p1',
        strategy: 'fixed-window',
        limit: 5,
        windowMs: 60_000,
        identifier: 'user:1',
      };
      registerPolicy(policy);
      const result = checkLimit('p1');
      expect(result.allowed).toBe(true);
      expect(result.strategy).toBe('fixed-window');
    });

    it('returns not-allowed for unknown policy', () => {
      const result = checkLimit('unknown');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('removes a policy', () => {
      registerPolicy({ id: 'p2', strategy: 'fixed-window', limit: 10, windowMs: 60_000, identifier: 'user:2' });
      removePolicy('p2');
      const result = checkLimit('p2');
      expect(result.allowed).toBe(false);
    });
  });

  describe('fixed-window strategy', () => {
    it('enforces the request limit', () => {
      registerPolicy({ id: 'fw', strategy: 'fixed-window', limit: 3, windowMs: 60_000, identifier: 'user:fw' });
      expect(checkLimit('fw').allowed).toBe(true);  // 1
      expect(checkLimit('fw').allowed).toBe(true);  // 2
      expect(checkLimit('fw').allowed).toBe(true);  // 3
      expect(checkLimit('fw').allowed).toBe(false); // 4 — blocked
    });

    it('tracks remaining correctly', () => {
      registerPolicy({ id: 'fw2', strategy: 'fixed-window', limit: 5, windowMs: 60_000, identifier: 'user:fw2' });
      checkLimit('fw2');
      checkLimit('fw2');
      const result = checkLimit('fw2');
      expect(result.remaining).toBe(2);
    });

    it('resets window after windowMs', () => {
      const now = Date.now();
      registerPolicy({ id: 'fw3', strategy: 'fixed-window', limit: 2, windowMs: 1_000, identifier: 'user:fw3' });
      checkLimit('fw3', now);
      checkLimit('fw3', now);
      expect(checkLimit('fw3', now).allowed).toBe(false);
      // After window expires
      expect(checkLimit('fw3', now + 1_001).allowed).toBe(true);
    });
  });

  describe('sliding-window strategy', () => {
    it('enforces the limit within sliding window', () => {
      registerPolicy({ id: 'sw', strategy: 'sliding-window', limit: 3, windowMs: 60_000, identifier: 'user:sw' });
      expect(checkLimit('sw').allowed).toBe(true);
      expect(checkLimit('sw').allowed).toBe(true);
      expect(checkLimit('sw').allowed).toBe(true);
      expect(checkLimit('sw').allowed).toBe(false);
    });
  });

  describe('token-bucket strategy', () => {
    it('allows requests up to limit', () => {
      registerPolicy({ id: 'tb', strategy: 'token-bucket', limit: 3, windowMs: 60_000, identifier: 'user:tb' });
      expect(checkLimit('tb').allowed).toBe(true);
      expect(checkLimit('tb').allowed).toBe(true);
      expect(checkLimit('tb').allowed).toBe(true);
      expect(checkLimit('tb').allowed).toBe(false);
    });

    it('refills tokens over time', () => {
      const now = Date.now();
      registerPolicy({ id: 'tb2', strategy: 'token-bucket', limit: 2, windowMs: 1_000, identifier: 'user:tb2' });
      checkLimit('tb2', now);
      checkLimit('tb2', now);
      expect(checkLimit('tb2', now).allowed).toBe(false);
      // After full window, should be refilled
      expect(checkLimit('tb2', now + 1_000).allowed).toBe(true);
    });
  });

  describe('leaky-bucket strategy', () => {
    it('allows requests up to limit', () => {
      registerPolicy({ id: 'lb', strategy: 'leaky-bucket', limit: 3, windowMs: 60_000, identifier: 'user:lb' });
      expect(checkLimit('lb').allowed).toBe(true);
      expect(checkLimit('lb').allowed).toBe(true);
      expect(checkLimit('lb').allowed).toBe(true);
      expect(checkLimit('lb').allowed).toBe(false);
    });
  });

  describe('quota tracking', () => {
    it('tracks quota used', () => {
      registerPolicy({ id: 'q1', strategy: 'fixed-window', limit: 10, windowMs: 60_000, identifier: 'user:q1' });
      checkLimit('q1');
      checkLimit('q1');
      checkLimit('q1');
      const quota = getQuota('q1');
      expect(quota.used).toBe(3);
      expect(quota.limit).toBe(10);
    });

    it('resets quota', () => {
      registerPolicy({ id: 'q2', strategy: 'fixed-window', limit: 5, windowMs: 60_000, identifier: 'user:q2' });
      checkLimit('q2');
      checkLimit('q2');
      resetQuota('q2');
      const quota = getQuota('q2');
      expect(quota.used).toBe(0);
    });
  });

  describe('generateReport', () => {
    it('generates a report with correct counts', () => {
      registerPolicy({ id: 'r1', strategy: 'fixed-window', limit: 2, windowMs: 60_000, identifier: 'user:r1' });
      checkLimit('r1'); // allowed
      checkLimit('r1'); // allowed
      checkLimit('r1'); // blocked
      const report = generateReport('r1');
      expect(report.policyId).toBe('r1');
      expect(report.totalRequests).toBe(3);
      expect(report.allowedRequests).toBe(2);
      expect(report.blockedRequests).toBe(1);
      expect(report.quota).toBeDefined();
    });

    it('returns zeroed report for unknown policy', () => {
      const report = generateReport('nope');
      expect(report.totalRequests).toBe(0);
      expect(report.blockedRequests).toBe(0);
    });
  });
});
