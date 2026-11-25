/**
 * On-chain transaction history for one or more wallets, fetched from Horizon's
 * `/accounts/{id}/payments` endpoint and normalised for filtering, searching,
 * pagination and export.
 */

// Same default as `src/lib/stellar.ts`, duplicated to avoid pulling the SDK into this module.
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export function explorerTxLink(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export type TxType = "payment" | "path_payment" | "create_account" | "account_merge" | "contract";
export type TxDirection = "incoming" | "outgoing" | "self";

export const TX_TYPE_LABELS: Record<TxType, string> = {
  payment: "Payment",
  path_payment: "Path payment",
  create_account: "Account created",
  account_merge: "Account merge",
  contract: "Contract call",
};

export interface TxRecord {
  id: string;
  pagingToken: string;
  wallet: string;
  hash: string;
  type: TxType;
  direction: TxDirection;
  /** Decimal string as returned by Horizon, e.g. "12.5000000". */
  amount: string;
  asset: string;
  from: string;
  to: string;
  counterparty: string;
  createdAt: string;
  memo: string;
  feeCharged: string;
  successful: boolean;
}

/** Subset of a Horizon payment-operation record that we read. */
export interface HorizonPaymentRecord {
  id: string;
  paging_token: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  transaction_successful?: boolean;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  funder?: string;
  account?: string;
  starting_balance?: string;
  into?: string;
  source_account?: string;
  transaction?: { memo?: string; fee_charged?: string | number };
}

function mapType(type: string): TxType {
  if (type.startsWith("path_payment")) return "path_payment";
  if (type === "create_account") return "create_account";
  if (type === "account_merge") return "account_merge";
  if (type === "invoke_host_function") return "contract";
  return "payment";
}

export function normalizeRecord(rec: HorizonPaymentRecord, wallet: string): TxRecord {
  const type = mapType(rec.type);
  let from = rec.from ?? rec.source_account ?? "";
  let to = rec.to ?? "";
  let amount = rec.amount ?? "0";
  let asset = rec.asset_type === "native" || !rec.asset_type ? "XLM" : rec.asset_code ?? "UNKNOWN";

  if (type === "create_account") {
    from = rec.funder ?? from;
    to = rec.account ?? "";
    amount = rec.starting_balance ?? "0";
    asset = "XLM";
  } else if (type === "account_merge") {
    from = rec.account ?? from;
    to = rec.into ?? "";
    asset = "XLM";
  }

  const direction: TxDirection = from === wallet && to === wallet ? "self" : to === wallet ? "incoming" : "outgoing";

  return {
    id: rec.id,
    pagingToken: rec.paging_token,
    wallet,
    hash: rec.transaction_hash,
    type,
    direction,
    amount,
    asset,
    from,
    to,
    counterparty: direction === "incoming" ? from : to,
    createdAt: rec.created_at,
    memo: rec.transaction?.memo ?? "",
    feeCharged: rec.transaction?.fee_charged != null ? String(rec.transaction.fee_charged) : "",
    successful: rec.transaction_successful !== false,
  };
}

export interface FetchHistoryResult {
  records: TxRecord[];
  /** Cursor for the next (older) page, or null when exhausted. */
  nextCursor: string | null;
}

/** Fetches one page (newest first) of a wallet's payment operations. */
export async function fetchTransactionHistory(
  wallet: string,
  {
    cursor,
    limit = 100,
    horizonUrl = HORIZON_URL,
    fetchImpl = fetch,
  }: { cursor?: string | null; limit?: number; horizonUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<FetchHistoryResult> {
  const params = new URLSearchParams({ order: "desc", limit: String(limit), join: "transactions" });
  if (cursor) params.set("cursor", cursor);
  const url = `${horizonUrl.replace(/\/+$/, "")}/accounts/${encodeURIComponent(wallet)}/payments?${params}`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return { records: [], nextCursor: null }; // unfunded account
  if (!res.ok) throw new Error(`Horizon request failed (${res.status})`);
  const body = (await res.json()) as { _embedded?: { records?: HorizonPaymentRecord[] } };
  const raw = body._embedded?.records ?? [];
  const records = raw.map((r) => normalizeRecord(r, wallet));
  return { records, nextCursor: raw.length === limit ? raw[raw.length - 1].paging_token : null };
}

// ── Filtering & search ──────────────────────────────────────────────────────

export interface TxFilters {
  wallets?: string[];
  types?: TxType[];
  direction?: TxDirection | "all";
  /** Inclusive, YYYY-MM-DD. */
  fromDate?: string;
  /** Inclusive, YYYY-MM-DD. */
  toDate?: string;
  asset?: string;
  search?: string;
}

export function filterTransactions(records: TxRecord[], filters: TxFilters): TxRecord[] {
  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00Z`).getTime() : null;
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999Z`).getTime() : null;
  const q = filters.search?.trim().toLowerCase() ?? "";
  const asset = filters.asset?.trim().toUpperCase() ?? "";

  return records.filter((r) => {
    if (filters.wallets?.length && !filters.wallets.includes(r.wallet)) return false;
    if (filters.types?.length && !filters.types.includes(r.type)) return false;
    if (filters.direction && filters.direction !== "all" && r.direction !== filters.direction) return false;
    if (asset && r.asset.toUpperCase() !== asset) return false;
    const t = new Date(r.createdAt).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    if (q) {
      const haystack = [r.hash, r.from, r.to, r.memo, r.amount, r.asset, TX_TYPE_LABELS[r.type]]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Merge records from several wallets, de-duplicated and newest first. */
export function mergeHistories(...lists: TxRecord[][]): TxRecord[] {
  const seen = new Map<string, TxRecord>();
  for (const list of lists) for (const r of list) seen.set(`${r.wallet}:${r.id}`, r);
  return Array.from(seen.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    totalPages,
    total: items.length,
  };
}

// ── Export ──────────────────────────────────────────────────────────────────

const CSV_COLUMNS: (keyof TxRecord)[] = [
  "createdAt",
  "wallet",
  "type",
  "direction",
  "amount",
  "asset",
  "from",
  "to",
  "memo",
  "feeCharged",
  "successful",
  "hash",
];

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCSV(records: TxRecord[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...rows].join("\n");
}

export function transactionsToJSON(records: TxRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
