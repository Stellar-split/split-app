import { NextRequest, NextResponse } from 'next/server';
import { defaultLiquidityPoolManager } from '@/lib/settlement';

export async function GET() {
  const pools = defaultLiquidityPoolManager.getAllPools();
  const metrics = pools.map((p) => defaultLiquidityPoolManager.getHealthMetrics(p.poolId));

  return NextResponse.json({
    success: true,
    pools,
    metrics,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, poolId, amountA, amountB, shares, assetA, assetB, feeRate, providerId } = body;

    if (action === 'create') {
      const pool = defaultLiquidityPoolManager.createPool({
        poolId,
        assetA,
        assetB,
        reserveA: Number(amountA),
        reserveB: Number(amountB),
        feeRate: feeRate ? Number(feeRate) : undefined,
        providerId: providerId || 'custom-lp',
      });
      return NextResponse.json({ success: true, pool });
    }

    if (action === 'add') {
      const result = defaultLiquidityPoolManager.addLiquidity({
        poolId,
        amountA: Number(amountA),
        amountB: Number(amountB),
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'remove') {
      const result = defaultLiquidityPoolManager.removeLiquidity({
        poolId,
        shares: Number(shares),
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: create, add, remove' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
