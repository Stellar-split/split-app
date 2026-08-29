import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    const response = await fetch(`${HORIZON_URL}/accounts/${address}`);
    if (!response.ok) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const account = await response.json();

    let xlmBalance = "0.0";
    let usdcBalance = "0.0";

    if (account.balances) {
      const nativeBalance = account.balances.find((b: any) => b.asset_type === "native");
      if (nativeBalance) {
        xlmBalance = (parseFloat(nativeBalance.balance) || 0).toFixed(7);
      }

      if (USDC_CONTRACT_ID) {
        const usdcLineItem = account.balances.find(
          (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_CONTRACT_ID
        );
        if (usdcLineItem) {
          usdcBalance = (parseFloat(usdcLineItem.balance) || 0).toFixed(2);
        }
      }
    }

    return NextResponse.json({ xlm: xlmBalance, usdc: usdcBalance });
  } catch (error) {
    console.error("Wallet balance fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
