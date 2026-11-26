export type Strategy = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';

export interface RateLimitPolicy {
  id: string;
  strategy: Strategy;
  limit: number;
  windowMs: number;
  identifier: string;
}

export interface QuotaRecord {
  policyId: string;
  identifier: string;
  used: number;
  limit: number;
  windowStart: number;
  windowEnd: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
  strategy: Strategy;
}

export interface RateLimitReport {
  policyId: string;
  identifier: string;
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  windowStart: number;
  windowEnd: number;
  quota: QuotaRecord;
}

interface FixedWindowState {
  windowStart: number;
  count: number;
}

interface SlidingWindowState {
  timestamps: number[];
}

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

interface LeakyBucketState {
  leakyCount: number;
  lastDrain: number;
}

interface PolicyStats {
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
}

const policies = new Map<string, RateLimitPolicy>();
const fixedWindowStates = new Map<string, FixedWindowState>();
const slidingWindowStates = new Map<string, SlidingWindowState>();
const tokenBucketStates = new Map<string, TokenBucketState>();
const leakyBucketStates = new Map<string, LeakyBucketState>();
const statsMap = new Map<string, PolicyStats>();

function getStats(policyId: string): PolicyStats {
  if (!statsMap.has(policyId)) {
    statsMap.set(policyId, { totalRequests: 0, blockedRequests: 0, allowedRequests: 0 });
  }
  return statsMap.get(policyId)!;
}

function checkFixedWindow(policy: RateLimitPolicy, now: number): RateLimitCheckResult {
  const state = fixedWindowStates.get(policy.id) ?? { windowStart: now, count: 0 };

  if (now >= state.windowStart + policy.windowMs) {
    state.windowStart = now;
    state.count = 0;
  }

  const allowed = state.count < policy.limit;
  if (allowed) {
    state.count += 1;
  }
  fixedWindowStates.set(policy.id, state);

  const windowEnd = state.windowStart + policy.windowMs;
  const remaining = Math.max(0, policy.limit - state.count);
  return {
    allowed,
    remaining,
    resetAt: windowEnd,
    retryAfterMs: allowed ? 0 : windowEnd - now,
    strategy: policy.strategy,
  };
}

function checkSlidingWindow(policy: RateLimitPolicy, now: number): RateLimitCheckResult {
  const state = slidingWindowStates.get(policy.id) ?? { timestamps: [] };

  // Prune timestamps outside the window
  state.timestamps = state.timestamps.filter(t => now - t < policy.windowMs);

  const allowed = state.timestamps.length < policy.limit;
  if (allowed) {
    state.timestamps.push(now);
  }
  slidingWindowStates.set(policy.id, state);

  const remaining = Math.max(0, policy.limit - state.timestamps.length);
  const oldest = state.timestamps[0] ?? now;
  const resetAt = oldest + policy.windowMs;
  return {
    allowed,
    remaining,
    resetAt,
    retryAfterMs: allowed ? 0 : resetAt - now,
    strategy: policy.strategy,
  };
}

function checkTokenBucket(policy: RateLimitPolicy, now: number): RateLimitCheckResult {
  const state = tokenBucketStates.get(policy.id) ?? { tokens: policy.limit, lastRefill: now };

  const elapsed = now - state.lastRefill;
  const refillRate = policy.limit / policy.windowMs;
  const refilled = elapsed * refillRate;
  state.tokens = Math.min(policy.limit, state.tokens + refilled);
  state.lastRefill = now;

  const allowed = state.tokens >= 1;
  if (allowed) {
    state.tokens -= 1;
  }
  tokenBucketStates.set(policy.id, state);

  const remaining = Math.floor(state.tokens);
  const tokensNeeded = 1 - state.tokens;
  const retryAfterMs = allowed ? 0 : Math.ceil(tokensNeeded / refillRate);
  const resetAt = now + Math.ceil((policy.limit - state.tokens) / refillRate);
  return {
    allowed,
    remaining,
    resetAt,
    retryAfterMs,
    strategy: policy.strategy,
  };
}

function checkLeakyBucket(policy: RateLimitPolicy, now: number): RateLimitCheckResult {
  const state = leakyBucketStates.get(policy.id) ?? { leakyCount: 0, lastDrain: now };

  const elapsed = now - state.lastDrain;
  const drainRate = policy.limit / policy.windowMs;
  // Only whole leaked units free up capacity — sub-unit drains from a few
  // milliseconds of real time between back-to-back calls must not nudge a
  // full bucket back under its limit.
  const drained = Math.floor(elapsed * drainRate);
  state.leakyCount = Math.max(0, state.leakyCount - drained);
  state.lastDrain = now;

  const allowed = state.leakyCount < policy.limit;
  if (allowed) {
    state.leakyCount += 1;
  }
  leakyBucketStates.set(policy.id, state);

  const remaining = Math.max(0, Math.floor(policy.limit - state.leakyCount));
  const retryAfterMs = allowed ? 0 : Math.ceil((state.leakyCount - policy.limit + 1) / drainRate);
  return {
    allowed,
    remaining,
    resetAt: now + Math.ceil(state.leakyCount / drainRate),
    retryAfterMs,
    strategy: policy.strategy,
  };
}

export function registerPolicy(policy: RateLimitPolicy): void {
  policies.set(policy.id, policy);
}

export function removePolicy(id: string): void {
  policies.delete(id);
  fixedWindowStates.delete(id);
  slidingWindowStates.delete(id);
  tokenBucketStates.delete(id);
  leakyBucketStates.delete(id);
  statsMap.delete(id);
}

export function checkLimit(policyId: string, now?: number): RateLimitCheckResult {
  const policy = policies.get(policyId);
  if (!policy) {
    return { allowed: false, remaining: 0, resetAt: 0, retryAfterMs: 0, strategy: 'fixed-window' };
  }

  const ts = now ?? Date.now();
  const stats = getStats(policyId);
  stats.totalRequests += 1;

  let result: RateLimitCheckResult;
  switch (policy.strategy) {
    case 'fixed-window':
      result = checkFixedWindow(policy, ts);
      break;
    case 'sliding-window':
      result = checkSlidingWindow(policy, ts);
      break;
    case 'token-bucket':
      result = checkTokenBucket(policy, ts);
      break;
    case 'leaky-bucket':
      result = checkLeakyBucket(policy, ts);
      break;
  }

  if (result.allowed) {
    stats.allowedRequests += 1;
  } else {
    stats.blockedRequests += 1;
  }

  return result;
}

export function getQuota(policyId: string, now?: number): QuotaRecord {
  const policy = policies.get(policyId);
  const ts = now ?? Date.now();

  if (!policy) {
    return {
      policyId,
      identifier: '',
      used: 0,
      limit: 0,
      windowStart: ts,
      windowEnd: ts,
    };
  }

  let used = 0;
  let windowStart = ts;
  const windowEnd = windowStart + policy.windowMs;

  switch (policy.strategy) {
    case 'fixed-window': {
      const state = fixedWindowStates.get(policyId);
      if (state) {
        used = state.count;
        windowStart = state.windowStart;
      }
      break;
    }
    case 'sliding-window': {
      const state = slidingWindowStates.get(policyId);
      if (state) {
        used = state.timestamps.filter(t => ts - t < policy.windowMs).length;
        windowStart = ts - policy.windowMs;
      }
      break;
    }
    case 'token-bucket': {
      const state = tokenBucketStates.get(policyId);
      if (state) {
        used = Math.ceil(policy.limit - state.tokens);
        windowStart = state.lastRefill;
      }
      break;
    }
    case 'leaky-bucket': {
      const state = leakyBucketStates.get(policyId);
      if (state) {
        used = Math.ceil(state.leakyCount);
        windowStart = state.lastDrain;
      }
      break;
    }
  }

  return {
    policyId,
    identifier: policy.identifier,
    used: Math.max(0, used),
    limit: policy.limit,
    windowStart,
    windowEnd: windowStart + policy.windowMs,
  };
}

export function generateReport(policyId: string, now?: number): RateLimitReport {
  const policy = policies.get(policyId);
  const ts = now ?? Date.now();

  if (!policy) {
    const emptyQuota: QuotaRecord = {
      policyId,
      identifier: '',
      used: 0,
      limit: 0,
      windowStart: ts,
      windowEnd: ts,
    };
    return {
      policyId,
      identifier: '',
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      windowStart: ts,
      windowEnd: ts,
      quota: emptyQuota,
    };
  }

  const stats = getStats(policyId);
  const quota = getQuota(policyId, ts);

  return {
    policyId,
    identifier: policy.identifier,
    totalRequests: stats.totalRequests,
    blockedRequests: stats.blockedRequests,
    allowedRequests: stats.allowedRequests,
    windowStart: quota.windowStart,
    windowEnd: quota.windowEnd,
    quota,
  };
}

export function resetQuota(policyId: string): void {
  fixedWindowStates.delete(policyId);
  slidingWindowStates.delete(policyId);
  tokenBucketStates.delete(policyId);
  leakyBucketStates.delete(policyId);
}

export function resetAll(): void {
  policies.clear();
  fixedWindowStates.clear();
  slidingWindowStates.clear();
  tokenBucketStates.clear();
  leakyBucketStates.clear();
  statsMap.clear();
}
