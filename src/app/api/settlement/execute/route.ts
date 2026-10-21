import { NextRequest, NextResponse } from 'next/server';
import { defaultSettlementEngine } from '@/lib/settlement';
import { applyRateLimit } from '@/lib/middleware/rateLimitMiddleware';
import { PAYMENT_RATE_LIMIT } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const rateCheck = applyRateLimit(req, PAYMENT_RATE_LIMIT);
  if (rateCheck.limited) return rateCheck.response;
  try {
    const body = await req.json();
    const {
      invoiceId,
      quoteId,
      sourceAsset,
      destinationAsset,
      sourceAmount,
      expectedDestinationAmount,
      payerAddress,
      recipientAddress,
      maxSlippagePct,
    } = body;

    if (!invoiceId || !sourceAsset || !destinationAsset || !sourceAmount || !payerAddress || !recipientAddress) {
      return NextResponse.json(
        { error: 'Missing required settlement parameters' },
        { status: 400 }
      );
    }

    const result = await defaultSettlementEngine.executeInstantSettlement({
      invoiceId,
      quoteId,
      sourceAsset,
      destinationAsset,
      sourceAmount: Number(sourceAmount),
      expectedDestinationAmount: Number(expectedDestinationAmount || 0),
      payerAddress,
      recipientAddress,
      maxSlippagePct: maxSlippagePct ? Number(maxSlippagePct) : undefined,
    });

    return NextResponse.json({
      success: true,
      settlement: result.settlement,
      verification: result.verification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
