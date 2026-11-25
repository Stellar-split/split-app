import { NextRequest, NextResponse } from 'next/server';
import { defaultSettlementEngine } from '@/lib/settlement';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const settlementId = searchParams.get('settlementId') ?? undefined;

  return NextResponse.json({
    success: true,
    analytics: defaultSettlementEngine.getAnalytics(),
    auditTrail: defaultSettlementEngine.getAuditTrail(settlementId),
  });
}
