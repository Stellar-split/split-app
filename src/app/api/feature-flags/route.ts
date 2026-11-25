import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/apiClient';

export const dynamic = 'force-dynamic';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  variant?: string;
  description?: string;
}

interface FlagOverride {
  key: string;
  enabled?: boolean;
  variant?: string;
  userId?: string;
  rolloutPercentage?: number;
}

interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  attributes?: Record<string, unknown>;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: 'new-dashboard',
    enabled: true,
    rolloutPercentage: 25,
    variant: 'control',
    description: 'Gradual rollout of the redesigned dashboard',
  },
  {
    key: 'ab-test-checkout',
    enabled: true,
    rolloutPercentage: 50,
    variant: 'control',
    description: 'A/B test for the new checkout flow',
  },
  {
    key: 'analytics-v2',
    enabled: false,
    rolloutPercentage: 0,
    variant: 'control',
    description: 'Next generation analytics pipeline',
  },
];

const overridesStore = new Map<string, FlagOverride>();

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isInRollout(flagKey: string, context: EvaluationContext, percentage: number): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  const bucketKey = context.userId || context.sessionId || 'anonymous';
  const bucket = hashString(`${flagKey}:${bucketKey}`) % 100;
  return bucket < percentage;
}

function evaluateFlag(flag: FeatureFlag, context: EvaluationContext): FeatureFlag {
  const override = overridesStore.get(flag.key);
  const enabled = override?.enabled ?? flag.enabled;
  const rolloutPercentage = override?.rolloutPercentage ?? flag.rolloutPercentage;
  const variant = override?.variant ?? flag.variant;

  if (!enabled) {
    return { ...flag, enabled: false, variant: 'off' };
  }

  const inRollout = isInRollout(flag.key, context, rolloutPercentage);
  return {
    ...flag,
    enabled: inRollout,
    rolloutPercentage,
    variant: inRollout ? variant : 'off',
  };
}

function isAdmin(request: NextRequest): boolean {
  const role = request.headers.get('x-user-role');
  return role === 'admin';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? request.headers.get('x-user-id') ?? undefined;
    const sessionId = searchParams.get('sessionId') ?? undefined;

    const context: EvaluationContext = { userId, sessionId };

    const evaluated = DEFAULT_FLAGS.map((flag) => evaluateFlag(flag, context));

    return NextResponse.json(
      {
        flags: evaluated,
        context: { userId, sessionId },
        evaluatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to evaluate feature flags', details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as FlagOverride;

    if (!body || typeof body.key !== 'string' || body.key.length === 0) {
      return NextResponse.json({ error: 'Invalid payload: "key" is required' }, { status: 400 });
    }

    if (!DEFAULT_FLAGS.some((flag) => flag.key === body.key)) {
      return NextResponse.json({ error: `Unknown feature flag: ${body.key}` }, { status: 404 });
    }

    if (
      body.rolloutPercentage !== undefined &&
      (typeof body.rolloutPercentage !== 'number' ||
        body.rolloutPercentage < 0 ||
        body.rolloutPercentage > 100)
    ) {
      return NextResponse.json(
        { error: 'Invalid payload: "rolloutPercentage" must be between 0 and 100' },
        { status: 400 },
      );
    }

    const override: FlagOverride = {
      key: body.key,
      enabled: body.enabled,
      variant: body.variant,
      userId: body.userId,
      rolloutPercentage: body.rolloutPercentage,
    };

    const response = await apiClient.post('/api/feature-flags/overrides', override);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to persist feature flag override' },
        { status: response.status },
      );
    }

    overridesStore.set(body.key, override);

    return NextResponse.json(
      {
        success: true,
        override,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update feature flag override', details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Query parameter "key" is required' }, { status: 400 });
    }

    const response = await apiClient.delete(`/api/feature-flags/overrides/${encodeURIComponent(key)}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to remove feature flag override' },
        { status: response.status },
      );
    }

    overridesStore.delete(key);

    return NextResponse.json({ success: true, key }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove feature flag override', details: (error as Error).message },
      { status: 500 },
    );
  }
}