"use client";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import ContractEventRow from "@/components/settings/ContractEventRow";
import {
  MAX_LEDGER_RANGE,
  validateBlockRange,
  type ContractEventView,
  type EventTypeFilter,
} from "@/lib/contractEvents";

type ApiResponse = {
  events?: ContractEventView[];
  cursor?: string | null;
  error?: string;
  contractId?: string;
  latestLedger?: number;
};

const TYPE_CHIPS: { id: EventTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "contract", label: "Contract" },
  { id: "system", label: "System" },
  { id: "diagnostic", label: "Diagnostic" },
];

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = (await res.json()) as ApiResponse;
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
};

function buildKey(params: {
  cursor: string | null;
  type: EventTypeFilter;
  fromLedger: string;
  toLedger: string;
}) {
  const sp = new URLSearchParams();
  sp.set("limit", "50");
  sp.set("type", params.type);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.fromLedger) sp.set("fromLedger", params.fromLedger);
  if (params.toLedger) sp.set("toLedger", params.toLedger);
  return `/api/contract-events?${sp.toString()}`;
}

function ContractEventsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = (searchParams.get("type") as EventTypeFilter) || "all";
  const cursor = searchParams.get("cursor");
  const fromQ = searchParams.get("fromLedger") ?? "";
  const toQ = searchParams.get("toLedger") ?? "";

  const [fromLedger, setFromLedger] = useState(fromQ);
  const [toLedger, setToLedger] = useState(toQ);
  const [cursorStack, setCursorStack] = useState<string[]>([]); // previous page cursors

  const rangeError = useMemo(() => {
    const from = fromLedger === "" ? undefined : Number.parseInt(fromLedger, 10);
    const to = toLedger === "" ? undefined : Number.parseInt(toLedger, 10);
    if (fromLedger !== "" && Number.isNaN(from)) return "fromLedger must be a number";
    if (toLedger !== "" && Number.isNaN(to)) return "toLedger must be a number";
    return validateBlockRange(from, to);
  }, [fromLedger, toLedger]);

  const queryKey = useMemo(() => {
    if (rangeError) return null;
    return buildKey({
      cursor,
      type: ["contract", "system", "diagnostic", "all"].includes(type) ? type : "all",
      fromLedger: fromQ,
      toLedger: toQ,
    });
  }, [cursor, type, fromQ, toQ, rangeError]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse>(
    queryKey,
    fetcher,
    {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    }
  );

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const onType = (t: EventTypeFilter) => {
    setCursorStack([]);
    replaceParams({ type: t === "all" ? null : t, cursor: null });
  };

  const applyRange = () => {
    if (rangeError) return;
    setCursorStack([]);
    replaceParams({
      fromLedger: fromLedger || null,
      toLedger: toLedger || null,
      cursor: null,
    });
  };

  const events = data?.events ?? [];
  const nextCursor = data?.cursor ?? null;

  const goNext = () => {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, cursor ?? ""]);
    replaceParams({ cursor: nextCursor });
  };

  const goPrev = () => {
    if (cursorStack.length === 0 && !cursor) return;
    const prev = [...cursorStack];
    const last = prev.pop() ?? null;
    setCursorStack(prev);
    replaceParams({ cursor: last || null });
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Contract Event Log</h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Inspect Soroban events for the StellarSplit contract via RPC{" "}
            <code className="text-indigo-300 text-xs">getEvents</code>. Decoded topics and
            values with cursor pagination, type filters, and ledger range controls.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="min-h-10 px-4 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800"
        >
          {isValidating ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data?.contractId ? (
        <p className="text-xs text-gray-500 font-mono mb-4 break-all">
          contractId: {data.contractId}
          {data.latestLedger != null ? ` · latestLedger ${data.latestLedger}` : ""}
        </p>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-200 text-sm">
          Set <code className="text-amber-100">NEXT_PUBLIC_CONTRACT_ID</code> to load live
          events. The explorer still validates filters and renders decoded rows when data is
          present.
        </div>
      )}

      {/* Type chips */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Event type filter">
        {TYPE_CHIPS.map((chip) => {
          const active = type === chip.id || (chip.id === "all" && !searchParams.get("type"));
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onType(chip.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Block range */}
      <section className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800">
        <h2 className="text-sm font-semibold mb-3">Block range</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            fromLedger
            <input
              type="number"
              inputMode="numeric"
              value={fromLedger}
              onChange={(e) => setFromLedger(e.target.value)}
              className="min-h-10 px-3 rounded-lg bg-black/40 border border-gray-700 text-sm text-gray-100 w-36"
              placeholder="optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            toLedger
            <input
              type="number"
              inputMode="numeric"
              value={toLedger}
              onChange={(e) => setToLedger(e.target.value)}
              className="min-h-10 px-3 rounded-lg bg-black/40 border border-gray-700 text-sm text-gray-100 w-36"
              placeholder="optional"
            />
          </label>
          <button
            type="button"
            onClick={applyRange}
            disabled={!!rangeError}
            className="min-h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-40"
          >
            Apply range
          </button>
          <p className="text-[11px] text-gray-500 self-center">
            Max range {MAX_LEDGER_RANGE} ledgers · from ≤ to
          </p>
        </div>
        {rangeError && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {rangeError}
          </p>
        )}
      </section>

      {/* Status */}
      {isLoading && !data && (
        <p className="text-sm text-gray-400 mb-4">Loading events…</p>
      )}
      {(error || data?.error) && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
          {error instanceof Error ? error.message : data?.error}
        </div>
      )}

      {/* List */}
      <div className="space-y-3 mb-6">
        {events.length === 0 && !isLoading && !rangeError && (
          <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-800 rounded-xl">
            No events in this window. Try widening the ledger range or check the contract ID.
          </p>
        )}
        {events.map((ev) => (
          <ContractEventRow key={ev.id} event={ev} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!cursor && cursorStack.length === 0}
          className="min-h-10 px-4 rounded-lg border border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-800"
        >
          ← Previous
        </button>
        <span className="text-xs text-gray-500">
          {events.length} event{events.length === 1 ? "" : "s"}
          {isValidating ? " · syncing" : ""}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!nextCursor || events.length === 0}
          className="min-h-10 px-4 rounded-lg border border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-800"
        >
          Next →
        </button>
      </div>
    </main>
  );
}


export default function ContractEventsPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
          <p className="text-sm text-gray-400">Loading contract events…</p>
        </main>
      }
    >
      <ContractEventsExplorer />
    </Suspense>
  );
}
