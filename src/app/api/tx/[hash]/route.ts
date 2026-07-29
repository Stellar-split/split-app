import { NextRequest, NextResponse } from "next/server";

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon.stellar.org";

interface ConfirmationsResponse {
  confirmations: number;
  confirmed: boolean;
  ledger: number;
  currentLedger: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { hash: string } }
): Promise<NextResponse<ConfirmationsResponse | { error: string }>> {
  const { hash } = params;

  if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
  }

  try {
    // Fetch the transaction and the latest ledger in parallel
    const [txRes, ledgersRes] = await Promise.all([
      fetch(`${HORIZON_URL}/transactions/${hash}`, { next: { revalidate: 0 } }),
      fetch(`${HORIZON_URL}/ledgers?order=desc&limit=1`, { next: { revalidate: 0 } }),
    ]);

    if (!txRes.ok) {
      const status = txRes.status === 404 ? 404 : 502;
      return NextResponse.json({ error: "Transaction not found" }, { status });
    }

    const [txData, ledgersData] = await Promise.all([txRes.json(), ledgersRes.json()]);

    const txLedger: number = txData.ledger;
    const currentLedger: number = ledgersData._embedded?.records?.[0]?.sequence ?? txLedger;
    const confirmations = Math.max(0, currentLedger - txLedger);

    return NextResponse.json({
      confirmations,
      confirmed: confirmations >= 3,
      ledger: txLedger,
      currentLedger,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch transaction data" }, { status: 502 });
  }
}
