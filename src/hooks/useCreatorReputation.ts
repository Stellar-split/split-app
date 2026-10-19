import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeCreatorReputation,
  type CreatorReputation,
  type CreatorReputationMetrics,
} from '../lib/creatorReputation';

/**
 * Raw accountability metrics for a creator, as fetched from the API/SDK.
 * These are the inputs to the reputation scoring algorithm.
 */
export interface RawCreatorMetrics {
  totalInvoices: number;
  fulfilledInvoices: number;
  onTimeInvoices: number;
  cancelledInvoices: number;
  completedInvoices: number;
  disputes: number;
  disputesLost: number;
  avgResponseHours: number;
  accountAgeDays: number;
}

export interface UseCreatorReputationResult {
  reputation: CreatorReputation | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Shape of the payload emitted by `subscribeAccountabilityMetrics`.
 * Partial updates are merged onto the last known metrics.
 */
type AccountabilityMetricsUpdate = Partial<RawCreatorMetrics>;

type AccountabilityMetricsListener = (update: AccountabilityMetricsUpdate) => void;

interface AccountabilityMetricsSubscription {
  unsubscribe: () => void;
}

/**
 * Minimal surface of the SDK/API we depend on. We resolve it lazily so the
 * hook keeps working in environments where the SDK is not wired up yet
 * (falling back to a mock fetch).
 */
interface ReputationSdk {
  fetchCreatorMetrics?: (address: string) => Promise<RawCreatorMetrics>;
  subscribeAccountabilityMetrics?: (
    address: string,
    listener: AccountabilityMetricsListener,
  ) => AccountabilityMetricsSubscription | (() => void);
}

const EMPTY_METRICS: RawCreatorMetrics = {
  totalInvoices: 0,
  fulfilledInvoices: 0,
  onTimeInvoices: 0,
  cancelledInvoices: 0,
  completedInvoices: 0,
  disputes: 0,
  disputesLost: 0,
  avgResponseHours: 0,
  accountAgeDays: 0,
};

/**
 * Attempt to resolve the reputation SDK from the global scope. The SDK is
 * expected to be attached to `globalThis` (e.g. by a provider) under
 * `__creatorReputationSdk`. Returns `null` when unavailable.
 */
function resolveSdk(): ReputationSdk | null {
  const candidate = (globalThis as Record<string, unknown>).__creatorReputationSdk;
  if (candidate && typeof candidate === 'object') {
    return candidate as ReputationSdk;
  }
  return null;
}

/**
 * Mock fetch used when no SDK is available. Produces deterministic,
 * plausible metrics derived from the address so the UI remains functional
 * in development and tests.
 */
async function mockFetchCreatorMetrics(address: string): Promise<RawCreatorMetrics> {
  // Simple deterministic hash of the address.
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }

  const totalInvoices = 10 + (hash % 40);
  const fulfilledInvoices = Math.floor(totalInvoices * (0.7 + ((hash >> 3) % 30) / 100));
  const onTimeInvoices = Math.floor(fulfilledInvoices * (0.75 + ((hash >> 5) % 25) / 100));
  const cancelledInvoices = totalInvoices - fulfilledInvoices;
  const completedInvoices = fulfilledInvoices;
  const disputes = (hash >> 7) % 5;
  const disputesLost = Math.min(disputes, (hash >> 9) % 3);
  const avgResponseHours = ((hash >> 11) % 72) + 0.5;
  const accountAgeDays = 30 + ((hash >> 13) % 700);

  return {
    totalInvoices,
    fulfilledInvoices,
    onTimeInvoices,
    cancelledInvoices,
    completedInvoices,
    disputes,
    disputesLost,
    avgResponseHours,
    accountAgeDays,
  };
}

async function fetchCreatorMetrics(address: string): Promise<RawCreatorMetrics> {
  const sdk = resolveSdk();
  if (sdk?.fetchCreatorMetrics) {
    const metrics = await sdk.fetchCreatorMetrics(address);
    return { ...EMPTY_METRICS, ...metrics };
  }
  return mockFetchCreatorMetrics(address);
}

function subscribeToMetrics(
  address: string,
  listener: AccountabilityMetricsListener,
): () => void {
  const sdk = resolveSdk();
  if (!sdk?.subscribeAccountabilityMetrics) {
    return () => {
      /* no-op */
    };
  }

  const subscription = sdk.subscribeAccountabilityMetrics(address, listener);

  if (typeof subscription === 'function') {
    return subscription;
  }

  if (subscription && typeof subscription.unsubscribe === 'function') {
    return () => subscription.unsubscribe();
  }

  return () => {
    /* no-op */
  };
}

/**
 * Map raw API metrics onto the scoring algorithm's expected input shape.
 */
function toReputationMetrics(raw: RawCreatorMetrics): CreatorReputationMetrics {
  return {
    totalInvoices: raw.totalInvoices,
    fulfilledInvoices: raw.fulfilledInvoices,
    onTimeInvoices: raw.onTimeInvoices,
    cancelledInvoices: raw.cancelledInvoices,
    completedInvoices: raw.completedInvoices,
    disputes: raw.disputes,
    disputesLost: raw.disputesLost,
    avgResponseHours: raw.avgResponseHours,
    accountAgeDays: raw.accountAgeDays,
  };
}

/**
 * React hook that fetches a creator's raw accountability metrics, computes
 * their reputation score via `computeCreatorReputation`, and keeps the score
 * up to date by subscribing to real-time metric updates.
 */
export function useCreatorReputation(address: string | null | undefined): UseCreatorReputationResult {
  const [reputation, setReputation] = useState<CreatorReputation | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(address));
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest raw metrics so real-time partial updates can be merged.
  const metricsRef = useRef<RawCreatorMetrics | null>(null);
  // Guard against state updates after unmount / address change.
  const mountedRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  const recompute = useCallback((raw: RawCreatorMetrics) => {
    metricsRef.current = raw;
    const next = computeCreatorReputation(toReputationMetrics(raw));
    if (mountedRef.current) {
      setReputation(next);
    }
  }, []);

  const load = useCallback(
    async (targetAddress: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const raw = await fetchCreatorMetrics(targetAddress);
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        recompute(raw);
      } catch (err) {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [recompute],
  );

  const refetch = useCallback(async () => {
    if (!address) {
      return;
    }
    await load(address);
  }, [address, load]);

  useEffect(() => {
    mountedRef.current = true;

    if (!address) {
      metricsRef.current = null;
      setReputation(null);
      setLoading(false);
      setError(null);
      return () => {
        mountedRef.current = false;
      };
    }

    void load(address);

    const unsubscribe = subscribeToMetrics(address, (update) => {
      if (!mountedRef.current) {
        return;
      }
      const base = metricsRef.current ?? EMPTY_METRICS;
      const merged: RawCreatorMetrics = { ...base, ...update };
      recompute(merged);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [address, load, recompute]);

  return { reputation, loading, error, refetch };
}

export default useCreatorReputation;