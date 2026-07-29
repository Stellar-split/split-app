import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon.stellar.org';

    const response = await fetch(`${horizonUrl}/fee_stats`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch fee stats from Horizon' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      baseFee: data.base_fee?.toString() || '100',
      resourceFee: data.soroban_resource_fee?.toString() || '0',
      ledgerCapacityUsage: data.ledger_capacity_usage?.toString() || '0',
    });
  } catch (error) {
    console.error('Error fetching fee stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee data' },
      { status: 500 }
    );
  }
}
