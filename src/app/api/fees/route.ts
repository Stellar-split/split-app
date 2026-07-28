import { NextResponse } from "next/server";
import { HORIZON_URL } from "@/lib/stellar";

export async function GET() {
  try {
    const response = await fetch(`${HORIZON_URL}/fee_stats`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch fee stats" }, { status: 502 });
    }

    const stats = await response.json();
    return NextResponse.json({
      p95_accepted_fee: Number(stats?.fee_charged?.p95 ?? stats?.max_fee?.p95 ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fee stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
