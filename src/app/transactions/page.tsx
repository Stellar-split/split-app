"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWalletContext } from "@/contexts/WalletContext";
import { getAddressBook } from "@/lib/addressBook";
import { useDebounce } from "@/hooks/useDebounce";
import {
  TX_TYPE_LABELS,
  downloadFile,
  explorerTxLink,
  fetchTransactionHistory,
  filterTransactions,
  mergeHistories,
  paginate,
  transactionsToCSV,
  transactionsToJSON,
  type TxDirection,
  type TxRecord,
  type TxType,
} from "@/lib/transactionHistory";

const PAGE_SIZE = 20;
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

interface WalletOption {
  address: string;
  label: string;
}

const short = (a: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "—");

/**
 * Transaction history for the connected wallet and any saved/added wallets,
 * with filtering by wallet, date range, type, direction and asset, free-text
 * search, a details panel, pagination and CSV/JSON export.
 */
export default function TransactionsPage() {
  const { address } = useWalletContext();
  const [extraWallets, setExtraWallets] = useState<WalletOption[]>([]);
  const [newWallet, setNewWallet] = useState("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);

  const [records, setRecords] = useState<TxRecord[]>([]);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [types, setTypes] = useState<TxType[]>([]);
  const [direction, setDirection] = useState<TxDirection | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [asset, setAsset] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TxRecord | null>(null);

  useEffect(() => {
    setExtraWallets(
      getAddressBook()
        .filter((e) => STELLAR_ADDRESS_RE.test(e.address))
        .map((e) => ({ address: e.address, label: e.nickname })),
    );
  }, []);

  const walletOptions = useMemo<WalletOption[]>(() => {
    const opts: WalletOption[] = address ? [{ address, label: "Connected wallet" }] : [];
    for (const w of extraWallets) if (!opts.some((o) => o.address === w.address)) opts.push(w);
    return opts;
  }, [address, extraWallets]);

  // Default to the connected wallet.
  useEffect(() => {
    if (address && selectedWallets.length === 0) setSelectedWallets([address]);
  }, [address, selectedWallets.length]);

  const load = useCallback(async (wallets: string[], more = false) => {
    if (wallets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        wallets
          .filter((w) => !more || cursors[w])
          .map(async (w) => ({ wallet: w, ...(await fetchTransactionHistory(w, { cursor: more ? cursors[w] : null })) })),
      );
      setCursors((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.wallet] = r.nextCursor;
        return next;
      });
      setRecords((prev) => mergeHistories(more ? prev : prev.filter((r) => !wallets.includes(r.wallet)), ...results.map((r) => r.records)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [cursors]);

  // Fetch history for newly selected wallets.
  useEffect(() => {
    const missing = selectedWallets.filter((w) => !(w in cursors));
    if (missing.length) load(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallets]);

  const filtered = useMemo(
    () =>
      filterTransactions(records, {
        wallets: selectedWallets,
        types,
        direction,
        fromDate,
        toDate,
        asset,
        search: debouncedSearch,
      }),
    [records, selectedWallets, types, direction, fromDate, toDate, asset, debouncedSearch],
  );

  useEffect(() => setPage(1), [selectedWallets, types, direction, fromDate, toDate, asset, debouncedSearch]);

  const pageData = paginate(filtered, page, PAGE_SIZE);
  const assets = useMemo(() => Array.from(new Set(records.map((r) => r.asset))).sort(), [records]);
  const canLoadMore = selectedWallets.some((w) => cursors[w]);

  const toggleWallet = (w: string) =>
    setSelectedWallets((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  const toggleType = (t: TxType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addWallet = () => {
    const w = newWallet.trim();
    if (!STELLAR_ADDRESS_RE.test(w)) {
      setError("Enter a valid Stellar public key (starts with G, 56 characters).");
      return;
    }
    if (!walletOptions.some((o) => o.address === w)) setExtraWallets((prev) => [...prev, { address: w, label: short(w) }]);
    setSelectedWallets((prev) => (prev.includes(w) ? prev : [...prev, w]));
    setNewWallet("");
    setError(null);
  };

  const resetFilters = () => {
    setTypes([]);
    setDirection("all");
    setFromDate("");
    setToDate("");
    setAsset("");
    setSearch("");
  };

  const exportAs = (format: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") downloadFile(transactionsToCSV(filtered), `transactions-${stamp}.csv`, "text/csv;charset=utf-8");
    else downloadFile(transactionsToJSON(filtered), `transactions-${stamp}.json`, "application/json");
  };

  const labelFor = (w: string) => walletOptions.find((o) => o.address === w)?.label ?? short(w);
  const input = "rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transaction history</h1>
          <p className="text-sm text-gray-500">On-chain payments for your wallets, straight from Horizon.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => exportAs("csv")} disabled={!filtered.length} className="rounded-md border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
            Export CSV
          </button>
          <button type="button" onClick={() => exportAs("json")} disabled={!filtered.length} className="rounded-md border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
            Export JSON
          </button>
        </div>
      </div>

      {/* Wallets */}
      <section aria-labelledby="wallets-heading" className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h2 id="wallets-heading" className="mb-2 text-sm font-semibold">Wallets</h2>
        {walletOptions.length === 0 && <p className="mb-2 text-sm text-gray-500">Connect a wallet or add an address below.</p>}
        <div className="mb-3 flex flex-wrap gap-2">
          {walletOptions.map((w) => (
            <button
              key={w.address}
              type="button"
              aria-pressed={selectedWallets.includes(w.address)}
              onClick={() => toggleWallet(w.address)}
              className={`rounded-full border px-3 py-1 text-xs ${selectedWallets.includes(w.address) ? "border-indigo-500 bg-indigo-500/15 text-indigo-300" : "border-gray-600 text-gray-400"}`}
              title={w.address}
            >
              {w.label} · {short(w.address)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={newWallet} onChange={(e) => setNewWallet(e.target.value)} placeholder="Add wallet address (G…)" aria-label="Add wallet address" className={`${input} flex-1 min-w-[16rem] font-mono`} />
          <button type="button" onClick={addWallet} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Add
          </button>
        </div>
      </section>

      {/* Filters */}
      <section aria-label="Filters" className="mb-4 grid gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hash, address, memo, amount…" aria-label="Search transactions" className={`${input} sm:col-span-2`} />
        <label className="flex flex-col text-xs text-gray-500">
          From
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          To
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={input} />
        </label>
        <select value={direction} onChange={(e) => setDirection(e.target.value as TxDirection | "all")} aria-label="Direction" className={input}>
          <option value="all">All directions</option>
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
          <option value="self">Self</option>
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Asset" className={input}>
          <option value="">All assets</option>
          {assets.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="group" aria-label="Transaction type">
          {(Object.keys(TX_TYPE_LABELS) as TxType[]).map((t) => (
            <label key={t} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
              {TX_TYPE_LABELS[t]}
            </label>
          ))}
          <button type="button" onClick={resetFilters} className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">
            Reset filters
          </button>
        </div>
      </section>

      {error && <p role="alert" className="mb-4 rounded-md border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">{error}</p>}

      <p className="mb-2 text-xs text-gray-500" aria-live="polite">
        {loading ? "Loading…" : `${pageData.total} transaction${pageData.total === 1 ? "" : "s"} (of ${records.length} loaded)`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Wallet</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Counterparty</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageData.items.map((r) => (
              <tr
                key={`${r.wallet}:${r.id}`}
                tabIndex={0}
                onClick={() => setSelected(r)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(r)}
                className="cursor-pointer border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/60"
              >
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{labelFor(r.wallet)}</td>
                <td className="px-3 py-2">{TX_TYPE_LABELS[r.type]}</td>
                <td className="px-3 py-2 font-mono text-xs" title={r.counterparty}>{short(r.counterparty)}</td>
                <td className={`px-3 py-2 text-right font-mono ${r.direction === "incoming" ? "text-green-500" : r.direction === "outgoing" ? "text-red-400" : ""}`}>
                  {r.direction === "incoming" ? "+" : r.direction === "outgoing" ? "−" : ""}
                  {Number(r.amount).toLocaleString(undefined, { maximumFractionDigits: 7 })} {r.asset}
                </td>
                <td className="px-3 py-2">{r.successful ? "✓" : <span className="text-red-400">Failed</span>}</td>
              </tr>
            ))}
            {!loading && pageData.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">No transactions match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage(pageData.page - 1)} disabled={pageData.page <= 1} className="rounded border border-gray-600 px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span>Page {pageData.page} of {pageData.totalPages}</span>
          <button type="button" onClick={() => setPage(pageData.page + 1)} disabled={pageData.page >= pageData.totalPages} className="rounded border border-gray-600 px-3 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
        {canLoadMore && (
          <button type="button" onClick={() => load(selectedWallets, true)} disabled={loading} className="rounded border border-indigo-500 px-3 py-1 text-indigo-400 disabled:opacity-40">
            Load older transactions
          </button>
        )}
      </nav>

      {selected && (
        <div role="dialog" aria-modal="true" aria-labelledby="tx-detail-title" className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white dark:bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 id="tx-detail-title" className="text-lg font-semibold">Transaction details</h2>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="text-gray-400 hover:text-white">✕</button>
            </div>
            <dl className="space-y-3 text-sm">
              {([
                ["Type", TX_TYPE_LABELS[selected.type]],
                ["Direction", selected.direction],
                ["Amount", `${selected.amount} ${selected.asset}`],
                ["From", selected.from],
                ["To", selected.to],
                ["Date", new Date(selected.createdAt).toLocaleString()],
                ["Memo", selected.memo || "—"],
                ["Fee (stroops)", selected.feeCharged || "—"],
                ["Status", selected.successful ? "Successful" : "Failed"],
                ["Hash", selected.hash],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase text-gray-500">{k}</dt>
                  <dd className="break-all font-mono">{v}</dd>
                </div>
              ))}
            </dl>
            <a href={explorerTxLink(selected.hash)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm text-indigo-400 hover:text-indigo-300">
              View on Stellar Expert ↗
            </a>
          </aside>
        </div>
      )}
    </main>
  );
}
