import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { fetchImportedTransaction, TxImportError } from "@/lib/txImport";

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ error: "hash query parameter is required" }, { status: 400 });
  }

  try {
    const data = await fetchImportedTransaction(hash);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof TxImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import transaction" },
      { status: 500 }
    );
  }
}
