import { NextResponse } from "next/server";

/**
 * Fiat currencies the UI can display. Keep in sync with FIAT_CURRENCIES in
 * UserPreferencesContext. Not exported — Next.js route modules may only export
 * route config fields and HTTP method handlers.
 */
const SUPPORTED_CURRENCIES = ["usd", "eur", "gbp", "brl"] as const;

/**
 * CoinGecko coin id for the asset invoices are denominated in.
 *
 * StellarSplit invoices are denominated in USDC (`usd-coin`), not XLM — pointing
 * this at `stellar` would render a fiat line that does not match the amount
 * beside it. Override per-deployment if that ever changes.
 */
const COIN_ID = process.env.NEXT_PUBLIC_RATE_COIN_ID ?? "usd-coin";

const COINGECKO_URL =
  `https://api.coingecko.com/api/v3/simple/price` +
  `?ids=${encodeURIComponent(COIN_ID)}&vs_currencies=${SUPPORTED_CURRENCIES.join(",")}`;

// Rates are refetched by clients every 60s; cache server-side for the same
// window so a burst of clients does not hammer CoinGecko's free tier.
export const revalidate = 60;

export async function GET() {
  try {
    const upstream = await fetch(COINGECKO_URL, {
      headers: { accept: "application/json" },
      next: { revalidate },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Rate provider responded ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as Record<string, Record<string, number>>;
    const rates = data[COIN_ID];

    if (!rates || typeof rates.usd !== "number") {
      return NextResponse.json(
        { error: "Rate provider returned an unexpected payload" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { coin: COIN_ID, rates, fetchedAt: Date.now() },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Rate provider unreachable: ${message}` }, { status: 502 });
  }
}
