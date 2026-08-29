import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { splitClient } from "@/lib/stellar";

const DEFAULT_LIMIT = 10;

interface HistoryResponse {
  payments: Array<{
    payer: string;
    amount: bigint;
    timestamp?: number;
  }>;
  nextCursor: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    50,
  );

  try {
    const invoice = await splitClient.getInvoice(params.id);

    // Parse cursor to get starting index
    const startIdx = cursor ? parseInt(cursor, 10) : 0;

    // Get the requested slice of payments
    const endIdx = startIdx + limit;
    const paymentsSlice = invoice.payments.slice(startIdx, endIdx);

    // Determine if there are more payments
    const nextCursor = endIdx < invoice.payments.length ? String(endIdx) : null;

    return NextResponse.json(
      {
        payments: paymentsSlice,
        nextCursor,
      } as HistoryResponse,
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch invoice history" },
      { status: 500 }
    );
  }
}
