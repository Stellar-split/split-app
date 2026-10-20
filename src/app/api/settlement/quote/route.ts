import { NextRequest, NextResponse } from 'next/server';
import { defaultRateQuotingSystem } from '@/lib/settlement';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceAsset, destinationAsset, amount, maxSlippagePct, preferredProviderId, invoiceId } = body;

    if (!sourceAsset || !destinationAsset || !amount) {
      return NextResponse.json(
        { error: 'sourceAsset, destinationAsset, and amount are required' },
        { status: 400 }
      );
    }

    const quote = await defaultRateQuotingSystem.requestQuote({
      sourceAsset,
      destinationAsset,
      amount: Number(amount),
      maxSlippagePct: maxSlippagePct ? Number(maxSlippagePct) : undefined,
      preferredProviderId,
      invoiceId,
    });

    return NextResponse.json({ success: true, quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const quoteId = searchParams.get('quoteId');

  if (!quoteId) {
    return NextResponse.json({ error: 'quoteId query param is required' }, { status: 400 });
  }

  const quote = defaultRateQuotingSystem.getQuote(quoteId);
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found or expired' }, { status: 404 });
  }

  return NextResponse.json({ success: true, quote });
}
