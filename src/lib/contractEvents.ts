/**
 * Soroban contract-event helpers: RPC fetch, XDR/JSON decode, block-range validation.
 */

import { contractId as DEFAULT_CONTRACT_ID, RPC_URL } from "./config";

export type EventTypeFilter = "contract" | "system" | "diagnostic" | "all";

export type DecodedField = {
  raw: string;
  display: string;
  decoded: boolean;
  error?: string;
};

export type ContractEventView = {
  id: string;
  type: string;
  ledger: number;
  ledgerClosedAt?: string;
  contractId?: string;
  topicCount: number;
  topics: DecodedField[];
  value: DecodedField;
  pagingToken?: string;
  txHash?: string;
};

export type ContractEventsPage = {
  events: ContractEventView[];
  cursor: string | null;
  oldestLedger?: number;
  latestLedger?: number;
};

export type BlockRange = {
  fromLedger?: number;
  toLedger?: number;
};

export const MAX_LEDGER_RANGE = 1000;
export const DEFAULT_PAGE_SIZE = 50;

export function validateBlockRange(
  fromLedger?: number | null,
  toLedger?: number | null
): string | null {
  const hasFrom = fromLedger != null && !Number.isNaN(fromLedger);
  const hasTo = toLedger != null && !Number.isNaN(toLedger);
  if (!hasFrom && !hasTo) return null;
  if (hasFrom && fromLedger! < 0) return "fromLedger must be >= 0";
  if (hasTo && toLedger! < 0) return "toLedger must be >= 0";
  if (hasFrom && hasTo) {
    if (fromLedger! > toLedger!) {
      return "fromLedger must be less than or equal to toLedger";
    }
    if (toLedger! - fromLedger! > MAX_LEDGER_RANGE) {
      return `Block range must not exceed ${MAX_LEDGER_RANGE} ledgers`;
    }
  }
  return null;
}

function toHex(bytes: Uint8Array | Buffer | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Best-effort decode of an ScVal / topic / value into a human-readable string. */
export function decodeScValLike(input: unknown): DecodedField {
  if (input == null) {
    return { raw: "", display: "null", decoded: true };
  }

  // Already JSON-ish from RPC
  if (typeof input === "object" && input !== null && !ArrayBuffer.isView(input)) {
    try {
      const display = JSON.stringify(input, null, 2);
      return { raw: display, display, decoded: true };
    } catch {
      const raw = String(input);
      return { raw, display: raw, decoded: false, error: "Unable to serialize JSON value" };
    }
  }

  if (typeof input === "string") {
    // Try base64 XDR → ScVal (sync require — used from Node API route + vitest)
    try {
      // eslint-disable-next-line
      const stellarSdk = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
      const scv = stellarSdk.xdr.ScVal.fromXDR(input, "base64");
      const display = scValToString(scv);
      return { raw: input, display, decoded: true };
    } catch (err) {
      // Hex fallback for undecodable XDR / opaque strings
      let hex = input;
      try {
        if (typeof Buffer !== "undefined") {
          hex = Buffer.from(input, "base64").toString("hex");
        }
      } catch {
        hex = input;
      }
      if (!/^[0-9a-fA-F]+$/.test(hex.replace(/^0x/, ""))) {
        // not base64-decodable either — show original with 0x if looks binary-ish
        hex = input.startsWith("0x") ? input : input;
      }
      return {
        raw: input,
        display: hex.startsWith("0x") ? hex : `0x${hex}`,
        decoded: false,
        error:
          err instanceof Error
            ? `XDR decode failed: ${err.message}`
            : "XDR decode failed",
      };
    }
  }

  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return { raw: String(input), display: String(input), decoded: true };
  }

  const raw = String(input);
  return { raw, display: raw, decoded: false, error: "Unsupported value type" };
}

function scValToString(scv: { switch: () => { name: string }; value: () => unknown }): string {
  const kind = scv.switch().name;
  try {
    switch (kind) {
      case "scvBool":
        return String(scv.value());
      case "scvVoid":
        return "void";
      case "scvU32":
      case "scvI32":
      case "scvU64":
      case "scvI64":
      case "scvU128":
      case "scvI128":
      case "scvU256":
      case "scvI256":
        return String((scv.value() as { toString: () => string }).toString?.() ?? scv.value());
      case "scvSymbol":
      case "scvString":
        return String(scv.value());
      case "scvBytes": {
        const bytes = scv.value() as Uint8Array;
        return `0x${toHex(bytes)}`;
      }
      case "scvAddress": {
        try {
          // eslint-disable-next-line
          const stellarSdk = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
          return stellarSdk.Address.fromScVal(scv as never).toString();
        } catch {
          return JSON.stringify(scv.value());
        }
      }
      case "scvVec": {
        const vec = (scv.value() as unknown[]) || [];
        return `[${vec.map((v) => scValToString(v as never)).join(", ")}]`;
      }
      case "scvMap": {
        const map = (scv.value() as Array<{ key: () => unknown; val: () => unknown }>) || [];
        const entries = map.map((e) => {
          const k = scValToString(e.key() as never);
          const v = scValToString(e.val() as never);
          return `${k}: ${v}`;
        });
        return `{${entries.join(", ")}}`;
      }
      default:
        return `${kind}(${JSON.stringify(scv.value())})`;
    }
  } catch (err) {
    return `decode-error:${kind}:${err instanceof Error ? err.message : String(err)}`;
  }
}

type RpcEvent = {
  id?: string;
  type?: string;
  ledger?: number | string;
  ledgerClosedAt?: string;
  contractId?: string;
  topic?: unknown[];
  value?: unknown;
  pagingToken?: string;
  txHash?: string;
  inSuccessfulContractCall?: boolean;
};

function normalizeEvent(ev: RpcEvent, index: number): ContractEventView {
  const topicsRaw = Array.isArray(ev.topic) ? ev.topic : [];
  const topics = topicsRaw.map((t) => decodeScValLike(t));
  const value = decodeScValLike(ev.value);
  const ledger =
    typeof ev.ledger === "string" ? parseInt(ev.ledger, 10) : Number(ev.ledger ?? 0);
  return {
    id: ev.id ?? ev.pagingToken ?? `evt-${ledger}-${index}`,
    type: ev.type ?? "contract",
    ledger: Number.isFinite(ledger) ? ledger : 0,
    ledgerClosedAt: ev.ledgerClosedAt,
    contractId: ev.contractId,
    topicCount: topics.length,
    topics,
    value,
    pagingToken: ev.pagingToken ?? ev.id,
    txHash: ev.txHash,
  };
}

export type FetchContractEventsParams = {
  rpcUrl?: string;
  contractId?: string;
  eventType?: EventTypeFilter;
  cursor?: string | null;
  limit?: number;
  fromLedger?: number | null;
  toLedger?: number | null;
  /** When true, skip live RPC and return empty (tests / missing config). */
  dryRun?: boolean;
};

/**
 * Call Soroban RPC `getEvents` and return a decoded page.
 * Filters by the app contract ID and optional event type / ledger range.
 */
export async function fetchContractEvents(
  params: FetchContractEventsParams = {}
): Promise<ContractEventsPage> {
  const rpcUrl = params.rpcUrl ?? RPC_URL;
  const cid = params.contractId ?? DEFAULT_CONTRACT_ID;
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_PAGE_SIZE, 1), 200);
  const eventType = params.eventType ?? "all";

  const rangeErr = validateBlockRange(params.fromLedger, params.toLedger);
  if (rangeErr) {
    throw new Error(rangeErr);
  }

  if (params.dryRun || !cid) {
    return { events: [], cursor: null };
  }

  const filters: Array<Record<string, unknown>> = [];
  if (eventType === "all") {
    // One filter per type so we still pin contractIds where applicable
    filters.push({ type: "contract", contractIds: [cid] });
    filters.push({ type: "diagnostic", contractIds: [cid] });
    // system events are not contract-scoped the same way — still request with contractIds when supported
    filters.push({ type: "system", contractIds: [cid] });
  } else {
    filters.push({ type: eventType, contractIds: [cid] });
  }

  const pagination: Record<string, unknown> = { limit };
  if (params.cursor) pagination.cursor = params.cursor;

  const rpcParams: Record<string, unknown> = {
    filters,
    pagination,
  };

  // startLedger required when no cursor (RPC protocol)
  if (!params.cursor) {
    if (params.fromLedger != null) {
      rpcParams.startLedger = params.fromLedger;
    } else {
      // Recent window: ask for latest ledger first, then start ~limit*2 ledgers back (bounded by MAX)
      const latest = await getLatestLedger(rpcUrl);
      const window = Math.min(MAX_LEDGER_RANGE, Math.max(limit * 20, 200));
      rpcParams.startLedger = Math.max(1, latest - window);
    }
  }

  if (params.toLedger != null) {
    rpcParams.endLedger = params.toLedger;
  }

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getEvents",
    params: rpcParams,
  };

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const json = (await res.json()) as {
    result?: {
      events?: RpcEvent[];
      cursor?: string;
      latestLedger?: number;
      oldestLedger?: number;
    };
    error?: { message?: string; code?: number };
  };

  if (json.error) {
    throw new Error(json.error.message ?? `RPC error ${json.error.code ?? ""}`);
  }

  const rawEvents = json.result?.events ?? [];
  const events = rawEvents.map((e, i) => normalizeEvent(e, i));

  // Prefer explicit cursor; else last event paging token
  const nextCursor =
    json.result?.cursor ??
    (events.length > 0 ? events[events.length - 1].pagingToken ?? null : null);

  return {
    events,
    cursor: nextCursor,
    oldestLedger: json.result?.oldestLedger,
    latestLedger: json.result?.latestLedger,
  };
}

async function getLatestLedger(rpcUrl: string): Promise<number> {
  const body = { jsonrpc: "2.0", id: 1, method: "getLatestLedger", params: null as null };
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return 1_000_000; // safe fallback window base
  const json = (await res.json()) as { result?: { sequence?: number } };
  return json.result?.sequence ?? 1_000_000;
}
