import { NextRequest, NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

const FRIENDBOT_URL = "https://friendbot.stellar.org";

/**
 * Dev-only proxy for the Stellar testnet Friendbot. Never available in
 * production — guarded both by NODE_ENV and by the app only rendering the
 * widget that calls this route on testnet.
 *
 * POST /api/dev/faucet  { publicKey: string }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet") {
    return NextResponse.json({ error: "Faucet is not available in this environment" }, { status: 403 });
  }

  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  let publicKey: unknown;
  try {
    ({ publicKey } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof publicKey !== "string" || !StrKey.isValidEd25519PublicKey(publicKey)) {
    return NextResponse.json({ error: "A valid Stellar public key is required" }, { status: 400 });
  }

  const friendbotResponse = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);

  if (!friendbotResponse.ok) {
    let detail: string | undefined;
    try {
      const body = await friendbotResponse.json();
      detail = body?.detail;
    } catch {
      // Friendbot didn't return JSON — fall through with no detail.
    }

    if (friendbotResponse.status === 400) {
      // Friendbot returns 400 when the account already exists / is already funded.
      return NextResponse.json(
        { alreadyFunded: true, message: detail ?? "This account is already funded." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: detail ?? "Friendbot request failed" },
      { status: 502 }
    );
  }

  const account = await fetch(`${HORIZON_URL}/accounts/${publicKey}`).then((res) =>
    res.ok ? res.json() : null
  );

  const nativeBalance = account?.balances?.find((b: any) => b.asset_type === "native");
  const xlm = nativeBalance ? (parseFloat(nativeBalance.balance) || 0).toFixed(7) : null;

  return NextResponse.json({ funded: true, xlm });
}
