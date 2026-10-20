import { NextRequest, NextResponse } from 'next/server';
import { defaultSettlementEngine, defaultSettlementVerifier } from '@/lib/settlement';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const settlementId = searchParams.get('settlementId');

  if (!settlementId) {
    return NextResponse.json({ error: 'settlementId is required' }, { status: 400 });
  }

  const result = defaultSettlementEngine.verifyExistingSettlement(settlementId);
  return NextResponse.json({ success: true, verification: result });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const verification = defaultSettlementVerifier.verifySettlement(body);
    return NextResponse.json({ success: true, verification });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
