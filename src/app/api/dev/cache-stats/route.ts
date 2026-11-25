import { NextResponse } from "next/server";
import { blockchainCache } from "@/lib/blockchainCache";

export const dynamic = "force-dynamic";

/**
 * Dev-only introspection endpoint for the blockchain-data in-memory cache
 * (hits/misses/hit rate/size), so the cache's effectiveness can be checked
 * without adding external monitoring. Not exposed in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }
  return NextResponse.json(blockchainCache.stats());
}
