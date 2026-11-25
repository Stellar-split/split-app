import { NextRequest, NextResponse } from 'next/server';
import { defaultSettlementFeeTracker } from '@/lib/settlement';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get('asset') || undefined;
  const invoiceId = searchParams.get('invoiceId');
  const providerId = searchParams.get('providerId');
  const since = searchParams.get('since') ? Number(searchParams.get('since')) : undefined;

  if (invoiceId) {
    const records = defaultSettlementFeeTracker.getFeesByInvoice(invoiceId);
    return NextResponse.json({ success: true, records });
  }

  if (providerId) {
    const records = defaultSettlementFeeTracker.getFeesByProvider(providerId);
    return NextResponse.json({ success: true, records });
  }

  const summary = defaultSettlementFeeTracker.getSummary(asset, since);
  const records = defaultSettlementFeeTracker.getAllRecords();

  return NextResponse.json({
    success: true,
    summary,
    records,
  });
}
