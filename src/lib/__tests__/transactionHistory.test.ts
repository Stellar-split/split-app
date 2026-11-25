import { describe, it, expect, vi } from "vitest";
import {
  fetchTransactionHistory,
  filterTransactions,
  mergeHistories,
  normalizeRecord,
  paginate,
  transactionsToCSV,
  transactionsToJSON,
  type HorizonPaymentRecord,
  type TxRecord,
} from "../transactionHistory";

const ME = "G" + "A".repeat(55);
const BOB = "G" + "B".repeat(55);
const ALICE = "G" + "C".repeat(55);

const raw = (over: Partial<HorizonPaymentRecord>): HorizonPaymentRecord => ({
  id: "1",
  paging_token: "1",
  type: "payment",
  created_at: "2026-10-01T12:00:00Z",
  transaction_hash: "hash1",
  transaction_successful: true,
  from: ME,
  to: BOB,
  amount: "10.0000000",
  asset_type: "native",
  transaction: { memo: "rent", fee_charged: "100" },
  ...over,
});

describe("normalizeRecord", () => {
  it("maps outgoing native payments", () => {
    const r = normalizeRecord(raw({}), ME);
    expect(r).toMatchObject({ type: "payment", direction: "outgoing", asset: "XLM", counterparty: BOB, memo: "rent" });
  });

  it("maps incoming credit-asset path payments", () => {
    const r = normalizeRecord(raw({ type: "path_payment_strict_send", from: BOB, to: ME, asset_type: "credit_alphanum4", asset_code: "USDC" }), ME);
    expect(r).toMatchObject({ type: "path_payment", direction: "incoming", asset: "USDC", counterparty: BOB });
  });

  it("maps create_account using funder/starting_balance", () => {
    const r = normalizeRecord(raw({ type: "create_account", from: undefined, to: undefined, funder: BOB, account: ME, starting_balance: "5" }), ME);
    expect(r).toMatchObject({ type: "create_account", direction: "incoming", amount: "5", from: BOB });
  });
});

const rec = (over: Partial<TxRecord>): TxRecord => ({
  ...normalizeRecord(raw({}), ME),
  ...over,
});

const sample: TxRecord[] = [
  rec({ id: "1", createdAt: "2026-10-01T10:00:00Z", hash: "aaa", type: "payment", direction: "outgoing", asset: "XLM" }),
  rec({ id: "2", createdAt: "2026-10-05T10:00:00Z", hash: "hash-two-xyz", type: "path_payment", direction: "incoming", asset: "USDC", from: ALICE, memo: "invoice 42" }),
  rec({ id: "3", createdAt: "2026-10-10T10:00:00Z", hash: "ccc", type: "create_account", direction: "incoming", wallet: BOB }),
];

describe("filterTransactions", () => {
  it("filters by each criterion independently", () => {
    expect(filterTransactions(sample, { wallets: [ME] })).toHaveLength(2);
    expect(filterTransactions(sample, { types: ["path_payment"] }).map((r) => r.id)).toEqual(["2"]);
    expect(filterTransactions(sample, { direction: "incoming" })).toHaveLength(2);
    expect(filterTransactions(sample, { asset: "usdc" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterTransactions(sample, { fromDate: "2026-10-05", toDate: "2026-10-05" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("combines filters", () => {
    expect(filterTransactions(sample, { wallets: [ME], direction: "incoming", fromDate: "2026-10-02" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterTransactions(sample, { wallets: [BOB], types: ["payment"] })).toHaveLength(0);
  });

  it("searches hash, addresses and memo case-insensitively", () => {
    expect(filterTransactions(sample, { search: "XYZ" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterTransactions(sample, { search: "invoice 42" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterTransactions(sample, { search: ALICE.slice(0, 10) }).map((r) => r.id)).toEqual(["2"]);
  });
});

describe("mergeHistories & paginate", () => {
  it("dedupes and sorts newest first", () => {
    const merged = mergeHistories(sample, [sample[0]]);
    expect(merged.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("clamps pages", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(items, 1, 20).items).toHaveLength(20);
    expect(paginate(items, 3, 20)).toMatchObject({ page: 3, totalPages: 3, total: 45 });
    expect(paginate(items, 3, 20).items).toHaveLength(5);
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, totalPages: 1, total: 0 });
  });
});

describe("export", () => {
  it("produces CSV with header, escaping and formula protection", () => {
    const csv = transactionsToCSV([rec({ memo: 'say "hi", ok' }), rec({ memo: "=HYPERLINK()" })]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("createdAt,wallet,type,direction,amount,asset,from,to,memo,feeCharged,successful,hash");
    expect(lines[1]).toContain('"say ""hi"", ok"');
    expect(lines[2]).toContain("'=HYPERLINK()");
    expect(lines).toHaveLength(3);
  });

  it("produces valid JSON", () => {
    expect(JSON.parse(transactionsToJSON(sample))).toHaveLength(3);
  });
});

describe("fetchTransactionHistory", () => {
  it("requests Horizon payments and returns a cursor when the page is full", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { records: [raw({ id: "9", paging_token: "pt9" })] } }),
    });
    const res = await fetchTransactionHistory(ME, { limit: 1, horizonUrl: "https://h.example/", fetchImpl: fetchImpl as never });
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://h.example/accounts/${ME}/payments?order=desc&limit=1&join=transactions`);
    expect(res.records[0].id).toBe("9");
    expect(res.nextCursor).toBe("pt9");
  });

  it("treats 404 (unfunded account) as empty and throws on other errors", async () => {
    const notFound = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchTransactionHistory(ME, { fetchImpl: notFound as never })).toEqual({ records: [], nextCursor: null });
    const broken = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchTransactionHistory(ME, { fetchImpl: broken as never })).rejects.toThrow("500");
  });
});
