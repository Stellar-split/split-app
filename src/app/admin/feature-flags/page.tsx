'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type FlagValue = boolean | string | number;

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  variants?: string[];
  defaultValue: FlagValue;
}

interface FlagOverride {
  enabled?: boolean;
  rolloutPercentage?: number;
}

const ADMIN_FLAG_KEY = 'admin.feature-flags';

const INITIAL_FLAGS: FeatureFlag[] = [
  {
    key: 'new-dashboard',
    description: 'Gradual rollout of the redesigned dashboard experience.',
    enabled: false,
    rolloutPercentage: 0,
    defaultValue: false,
  },
  {
    key: 'checkout-v2',
    description: 'A/B test for the streamlined checkout flow.',
    enabled: false,
    rolloutPercentage: 0,
    variants: ['control', 'variant-a', 'variant-b'],
    defaultValue: 'control',
  },
  {
    key: 'search-relevance',
    description: 'Improved search relevance ranking model.',
    enabled: true,
    rolloutPercentage: 25,
    defaultValue: false,
  },
  {
    key: 'beta-banner',
    description: 'Show the beta program banner to eligible users.',
    enabled: false,
    rolloutPercentage: 10,
    defaultValue: false,
  },
];

function clampPercentage(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function FeatureFlagsAdminPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Failed to load flags (${response.status})`);
      }
      const data = (await response.json()) as {
        flags?: FeatureFlag[];
        adminEnabled?: boolean;
      };
      if (Array.isArray(data.flags) && data.flags.length > 0) {
        setFlags(data.flags);
      }
      setAdminEnabled(data.adminEnabled ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load feature flags.');
      // Fall back to local defaults so the UI remains usable.
      setAdminEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const persistOverride = useCallback(
    async (key: string, override: FlagOverride) => {
      setSavingKey(key);
      setError(null);
      setStatusMessage(null);
      try {
        const response = await fetch('/api/admin/feature-flags', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, override }),
        });
        if (!response.ok) {
          throw new Error(`Failed to save flag "${key}" (${response.status})`);
        }
        setStatusMessage(`Saved changes for "${key}".`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save flag override.');
        throw err;
      } finally {
        setSavingKey(null);
      }
    },
    []
  );

  const handleToggle = useCallback(
    async (flag: FeatureFlag) => {
      const nextEnabled = !flag.enabled;
      const previous = flags;
      setFlags((current) =>
        current.map((item) =>
          item.key === flag.key ? { ...item, enabled: nextEnabled } : item
        )
      );
      try {
        await persistOverride(flag.key, { enabled: nextEnabled });
      } catch {
        setFlags(previous);
      }
    },
    [flags, persistOverride]
  );

  const handleRolloutChange = useCallback(
    (flag: FeatureFlag, rawValue: string) => {
      const nextPercentage = clampPercentage(Number(rawValue));
      setFlags((current) =>
        current.map((item) =>
          item.key === flag.key ? { ...item, rolloutPercentage: nextPercentage } : item
        )
      );
    },
    []
  );

  const handleRolloutCommit = useCallback(
    async (flag: FeatureFlag) => {
      try {
        await persistOverride(flag.key, { rolloutPercentage: flag.rolloutPercentage });
      } catch {
        // Error already surfaced via setError; reload to resync state.
        void loadFlags();
      }
    },
    [loadFlags, persistOverride]
  );

  const adminGate = useMemo(() => {
    if (adminEnabled === null) return 'loading';
    return adminEnabled ? 'allowed' : 'denied';
  }, [adminEnabled]);

  if (adminGate === 'loading' || loading) {
    return (
      <main className="mx-auto max-w-4xl p-6" aria-busy="true">
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p role="status" className="mt-4 text-sm text-gray-600">
          Loading feature flags…
        </p>
      </main>
    );
  }

  if (adminGate === 'denied') {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          You do not have access to feature flag management. The{' '}
          <code>{ADMIN_FLAG_KEY}</code> flag is disabled for your account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p className="mt-2 text-sm text-gray-600">
          Toggle features and control gradual rollout percentages. Changes are saved
          immediately and tracked in analytics.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          {statusMessage}
        </div>
      )}

      <ul className="space-y-4">
        {flags.map((flag) => {
          const isSaving = savingKey === flag.key;
          const toggleId = `flag-toggle-${flag.key}`;
          const rolloutId = `flag-rollout-${flag.key}`;
          const descId = `flag-desc-${flag.key}`;

          return (
            <li
              key={flag.key}
              className="rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <input
                      id={toggleId}
                      type="checkbox"
                      role="switch"
                      checked={flag.enabled}
                      disabled={isSaving}
                      aria-describedby={descId}
                      aria-label={`Enable ${flag.key}`}
                      onChange={() => void handleToggle(flag)}
                      className="h-5 w-5 cursor-pointer"
                    />
                    <label
                      htmlFor={toggleId}
                      className="font-mono text-sm font-medium"
                    >
                      {flag.key}
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        flag.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p id={descId} className="mt-2 text-sm text-gray-600">
                    {flag.description}
                  </p>
                  {flag.variants && flag.variants.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Variants: {flag.variants.join(', ')}
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-64">
                  <label
                    htmlFor={rolloutId}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Rollout: {flag.rolloutPercentage}%
                  </label>
                  <input
                    id={rolloutId}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={flag.rolloutPercentage}
                    disabled={isSaving}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={flag.rolloutPercentage}
                    aria-label={`Rollout percentage for ${flag.key}`}
                    onChange={(event) => handleRolloutChange(flag, event.target.value)}
                    onMouseUp={() => void handleRolloutCommit(flag)}
                    onTouchEnd={() => void handleRolloutCommit(flag)}
                    onKeyUp={() => void handleRolloutCommit(flag)}
                    className="mt-1 w-full cursor-pointer"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {isSaving && (
                <p role="status" className="mt-2 text-xs text-gray-500">
                  Saving…
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}