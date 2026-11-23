'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Feature flag context for gradual rollout, A/B testing and analytics.
 *
 * Flags are loaded from a remote source (with a local fallback) and evaluated
 * client-side. Exposure events are emitted once per flag per session so that
 * analytics can attribute behaviour to the flag variant a user saw.
 */

export type FeatureFlagValue = boolean | string | number;

export interface FeatureFlagDefinition {
  key: string;
  /** Default value used when no remote value is available. */
  defaultValue: FeatureFlagValue;
  /** Optional percentage (0-100) of users for whom the flag is enabled. */
  rolloutPercentage?: number;
  /** Optional variants for A/B testing. */
  variants?: Record<string, FeatureFlagValue>;
  /** Optional description for documentation / UI. */
  description?: string;
}

export type FeatureFlagMap = Record<string, FeatureFlagValue>;

export interface FeatureFlagContextValue {
  flags: FeatureFlagMap;
  isLoading: boolean;
  error: Error | null;
  /** Re-fetch flags from the remote source. */
  refresh: () => Promise<void>;
  /** Override a flag locally (used by the flag control UI). */
  setFlag: (key: string, value: FeatureFlagValue) => void;
  /** Evaluate a single flag. */
  getFlag: (key: string, fallback?: FeatureFlagValue) => FeatureFlagValue;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

const SESSION_STORAGE_KEY = 'ff:session-id';
const EXPOSURE_STORAGE_KEY = 'ff:exposures';
const OVERRIDES_STORAGE_KEY = 'ff:overrides';

/** Default flag definitions. Keep in sync with config/feature-flags.json. */
export const DEFAULT_FLAGS: FeatureFlagDefinition[] = [
  {
    key: 'new-dashboard',
    defaultValue: false,
    rolloutPercentage: 10,
    description: 'Gradual rollout of the redesigned dashboard.',
  },
  {
    key: 'checkout-experiment',
    defaultValue: 'control',
    variants: { control: 'control', variant_a: 'variant_a', variant_b: 'variant_b' },
    description: 'A/B test for the checkout flow.',
  },
];

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

/** Deterministic hash so a user consistently falls in the same bucket. */
function hashToBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

function evaluateFlag(
  definition: FeatureFlagDefinition,
  remoteValue: FeatureFlagValue | undefined,
  sessionId: string,
): FeatureFlagValue {
  if (remoteValue !== undefined) return remoteValue;

  if (definition.variants) {
    const variantKeys = Object.keys(definition.variants);
    if (variantKeys.length > 0) {
      const bucket = hashToBucket(`${sessionId}:${definition.key}`);
      const index = bucket % variantKeys.length;
      return definition.variants[variantKeys[index]];
    }
  }

  if (typeof definition.rolloutPercentage === 'number') {
    const bucket = hashToBucket(`${sessionId}:${definition.key}`);
    return bucket < definition.rolloutPercentage;
  }

  return definition.defaultValue;
}

function readOverrides(): FeatureFlagMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FeatureFlagMap) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: FeatureFlagMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore storage errors */
  }
}

function hasTrackedExposure(key: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.sessionStorage.getItem(EXPOSURE_STORAGE_KEY);
    const tracked: string[] = raw ? JSON.parse(raw) : [];
    if (tracked.includes(key)) return true;
    tracked.push(key);
    window.sessionStorage.setItem(EXPOSURE_STORAGE_KEY, JSON.stringify(tracked));
    return false;
  } catch {
    return false;
  }
}

/**
 * Emit an exposure event for analytics. Integrate with your analytics provider
 * (Segment, Amplitude, PostHog, etc.) inside this function.
 */
export function trackFeatureFlagExposure(
  key: string,
  value: FeatureFlagValue,
): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event: 'feature_flag_exposure',
    flagKey: key,
    flagValue: value,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  // Dispatch a DOM event so any analytics listener can pick it up.
  try {
    window.dispatchEvent(new CustomEvent('feature-flag-exposure', { detail: payload }));
  } catch {
    /* ignore */
  }

  // Optional: forward to a global analytics hook if present.
  const analytics = (window as unknown as { analytics?: { track?: (e: string, p: unknown) => void } })
    .analytics;
  if (analytics && typeof analytics.track === 'function') {
    analytics.track(payload.event, payload);
  }
}

async function fetchRemoteFlags(): Promise<FeatureFlagMap> {
  try {
    const response = await fetch('/api/feature-flags', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return {};
    const data = (await response.json()) as { flags?: FeatureFlagMap } | FeatureFlagMap;
    if (data && typeof data === 'object' && 'flags' in data && data.flags && typeof data.flags === 'object') {
      return data.flags as FeatureFlagMap;
    }
    return (data as FeatureFlagMap) ?? {};
  } catch {
    return {};
  }
}

export interface FeatureFlagProviderProps {
  children: React.ReactNode;
  /** Optional pre-loaded flags (e.g. from the server). */
  initialFlags?: FeatureFlagMap;
  /** Definitions to evaluate. Defaults to DEFAULT_FLAGS. */
  definitions?: FeatureFlagDefinition[];
}

export function FeatureFlagProvider({
  children,
  initialFlags,
  definitions = DEFAULT_FLAGS,
}: FeatureFlagProviderProps) {
  const [remoteFlags, setRemoteFlags] = useState<FeatureFlagMap>(initialFlags ?? {});
  const [overrides, setOverrides] = useState<FeatureFlagMap>({});
  const [isLoading, setIsLoading] = useState(!initialFlags);
  const [error, setError] = useState<Error | null>(null);
  const sessionIdRef = useRef<string>('server');
  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  useEffect(() => {
    sessionIdRef.current = getSessionId();
    setOverrides(readOverrides());
  }, []);

  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const flags = await fetchRemoteFlags();
      setRemoteFlags((prev) => ({ ...prev, ...flags }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load feature flags'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialFlags) return;
    void loadFlags();
  }, [initialFlags, loadFlags]);

  const flags = useMemo<FeatureFlagMap>(() => {
    const result: FeatureFlagMap = {};
    for (const definition of definitionsRef.current) {
      result[definition.key] = evaluateFlag(
        definition,
        remoteFlags[definition.key],
        sessionIdRef.current,
      );
    }
    // Include any remote flags not covered by definitions.
    for (const [key, value] of Object.entries(remoteFlags)) {
      if (!(key in result)) result[key] = value;
    }
    // Apply local overrides last (flag control UI).
    return { ...result, ...overrides };
  }, [remoteFlags, overrides]);

  // Emit exposure events once per flag per session.
  useEffect(() => {
    if (isLoading) return;
    for (const [key, value] of Object.entries(flags)) {
      if (!hasTrackedExposure(key)) {
        trackFeatureFlagExposure(key, value);
      }
    }
  }, [flags, isLoading]);

  const setFlag = useCallback((key: string, value: FeatureFlagValue) => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: value };
      writeOverrides(next);
      return next;
    });
  }, []);

  const getFlag = useCallback(
    (key: string, fallback: FeatureFlagValue = false): FeatureFlagValue => {
      if (key in flags) return flags[key];
      const definition = definitionsRef.current.find((d) => d.key === key);
      if (definition) {
        return evaluateFlag(definition, undefined, sessionIdRef.current);
      }
      return fallback;
    },
    [flags],
  );

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      flags,
      isLoading,
      error,
      refresh: loadFlags,
      setFlag,
      getFlag,
    }),
    [flags, isLoading, error, loadFlags, setFlag, getFlag],
  );

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

function useFeatureFlagContext(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
  }
  return context;
}

/** Evaluate a single feature flag. */
export function useFeatureFlag<T extends FeatureFlagValue = boolean>(
  key: string,
  fallback?: T,
): T {
  const { getFlag } = useFeatureFlagContext();
  return getFlag(key, fallback) as T;
}

/** Access the full flag map and helpers. */
export function useFeatureFlags(): FeatureFlagContextValue {
  return useFeatureFlagContext();
}

export default FeatureFlagProvider;