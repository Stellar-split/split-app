import { NextRequest, NextResponse } from "next/server";
import {
  fetchContractEvents,
  validateBlockRange,
  type EventTypeFilter,
} from "@/lib/contractEvents";
import { contractId, RPC_URL } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseIntParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/contract-events
 * Query:
 *  - cursor?: string
 *  - limit?: number (default 50)
 *  - type?: contract|system|diagnostic|all
 *  - fromLedger?: number
 *  - toLedger?: number
 *  - contractId?: override (defaults to NEXT_PUBLIC_CONTRACT_ID)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cursor = sp.get("cursor");
  const limit = parseIntParam(sp.get("limit")) ?? 50;
  const type = (sp.get("type") as EventTypeFilter | null) ?? "all";
  const fromLedger = parseIntParam(sp.get("fromLedger"));
  const toLedger = parseIntParam(sp.get("toLedger"));
  const cid = sp.get("contractId") || contractId;

  const rangeErr = validateBlockRange(fromLedger, toLedger);
  if (rangeErr) {
    return NextResponse.json({ error: rangeErr }, { status: 400 });
  }

  if (!cid) {
    return NextResponse.json(
      {
        error:
          "Contract ID is not configured. Set NEXT_PUBLIC_CONTRACT_ID or pass ?contractId=",
        events: [],
        cursor: null,
      },
      { status: 200 }
    );
  }

  try {
    const page = await fetchContractEvents({
      rpcUrl: RPC_URL,
      contractId: cid,
      eventType: ["contract", "system", "diagnostic", "all"].includes(type)
        ? type
        : "all",
      cursor,
      limit,
      fromLedger,
      toLedger,
    });

    return NextResponse.json({
      events: page.events,
      cursor: page.cursor,
      oldestLedger: page.oldestLedger,
      latestLedger: page.latestLedger,
      contractId: cid,
      rpcUrl: RPC_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, events: [], cursor: null }, { status: 502 });
  }
}
