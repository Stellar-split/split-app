'use client';

import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { splitClient } from '@/lib/stellar';
import { getFreighterPublicKey } from '@/lib/freighter';
import {
  compileFilter,
  FilterIndex,
  toURLParams,
  fromURLParams,
} from '@/lib/filterIndex';
import type { FilterCriteria } from '@/lib/filterIndex';
import { SkeletonCard } from '@/components/Skeleton';
import { formatAmount, truncateAddress } from '@stellar-split/sdk';
import type { Invoice } from '@stellar-split/sdk';
import {
  SEARCH_COLUMNS,
  COLUMN_LABELS,
  loadColumns,
  saveColumns,
  toggleColumn,
  isLastColumn,
  type SearchColumn,
} from '@/lib/searchColumns';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUSES = ['Pending', 'Released', 'Refunded'] as const;
const DEFAULT_TOKENS = ['USDC', 'XLM'];
const ITEM_HEIGHT_PX = 224; // estimated card + gap height
const LIST_HEIGHT_PX = 600;
const MAX_VISIBLE_NODES = 20;
const DEBOUNCE_MS = 300;

// ── Conversion helpers ─────────────────────────────────────────────────────────

function usdcToBigint(usdc: string): bigint | undefined {
  const n = parseFloat(usdc);
  if (!usdc || isNaN(n) || n < 0) return undefined;
  return BigInt(Math.round(n * 1e7));
}

function bigintToUsdc(stroops: bigint | undefined): string {
  return stroops === undefined ? '' : String(Number(stroops) / 1e7);
}

function tsToDateStr(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function dateStrToTs(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

function hasActiveFilters(c: FilterCriteria): boolean {
  return Object.keys(c).some((k) => {
    const v = (c as unknown as Record<string, unknown>)[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined;
  });
}

// ── Status badge styles ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-yellow-500/20 text-yellow-300',
  Released: 'bg-green-500/20 text-green-300',
  Refunded: 'bg-gray-500/20 text-gray-300',
};

// ── ColumnPicker ──────────────────────────────────────────────────────────────

function ColumnPicker({
  visibleColumns,
  onToggle,
}: {
  visibleColumns: SearchColumn[];
  onToggle: (col: SearchColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="column-picker-toggle"
        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Columns
      </button>
      {open && (
        <div
          data-testid="column-picker-dropdown"
          className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-2 min-w-[160px]"
        >
          {SEARCH_COLUMNS.map((col) => {
            const checked = visibleColumns.includes(col);
            const disabled = isLastColumn(visibleColumns, col);
            return (
              <label
                key={col}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-700 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(col)}
                  className="accent-indigo-500 w-4 h-4"
                  data-testid={`col-toggle-${col}`}
                />
                {COLUMN_LABELS[col]}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── InvoiceRow ────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  visibleColumns,
}: {
  invoice: Invoice;
  visibleColumns: SearchColumn[];
}) {
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const fundedPct = total > 0n ? Number((invoice.funded * 100n) / total) : 0;

  return (
    <div className="bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors cursor-pointer">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-300 shrink-0">
          Invoice #{invoice.id}
        </span>

        {visibleColumns.includes('amount') && (
          <span className="text-sm text-gray-400">
            {formatAmount(total)} USDC
          </span>
        )}

        {visibleColumns.includes('status') && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[invoice.status] ?? ''}`}
          >
            {invoice.status}
          </span>
        )}

        {visibleColumns.includes('deadline') && (
          <span className="text-xs text-gray-500">
            {new Date(invoice.deadline * 1000).toLocaleDateString()}
          </span>
        )}

        {visibleColumns.includes('creator') && (
          <span className="text-xs text-gray-500 font-mono">
            {truncateAddress(invoice.creator)}
          </span>
        )}

        {visibleColumns.includes('recipients') && (
          <span className="text-xs text-gray-500 font-mono">
            {invoice.recipients.map((r) => truncateAddress(r.address)).join(', ')}
          </span>
        )}

        {visibleColumns.includes('fundedPercent') && (
          <span className="text-xs text-gray-400">
            {fundedPct}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── VirtualList ────────────────────────────────────────────────────────────────

interface VirtualListProps {
  items: Invoice[];
  visibleColumns: SearchColumn[];
}

function VirtualList({ items, visibleColumns }: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIdx = Math.floor(scrollTop / ITEM_HEIGHT_PX);
  const endIdx = Math.min(items.length, startIdx + MAX_VISIBLE_NODES);
  const paddingTop = startIdx * ITEM_HEIGHT_PX;
  const paddingBottom = Math.max(0, (items.length - endIdx) * ITEM_HEIGHT_PX);

  return (
    <div
      data-testid="virtual-list"
      style={{ height: LIST_HEIGHT_PX, overflowY: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      role="list"
      aria-label="Invoice results"
    >
      <div style={{ paddingTop, paddingBottom }}>
        {items.slice(startIdx, endIdx).map((inv) => (
          <div
            key={inv.id}
            role="listitem"
            style={{ minHeight: ITEM_HEIGHT_PX }}
            className="mb-4"
          >
            <Link href={`/invoice/${inv.id}`}>
              <InvoiceRow invoice={inv} visibleColumns={visibleColumns} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ClearButton ────────────────────────────────────────────────────────────────

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="ml-1.5 text-gray-500 hover:text-red-400 transition-colors text-sm leading-none"
    >
      ×
    </button>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState({
  hasInvoices,
  hasFilters,
}: {
  hasInvoices: boolean;
  hasFilters: boolean;
}) {
  if (!hasInvoices) {
    return (
      <div
        data-testid="empty-no-invoices"
        className="text-center py-20 text-gray-400"
      >
        <p className="text-lg font-medium mb-2">No invoices yet</p>
        <p className="text-sm mb-4">Create your first invoice to get started.</p>
        <Link
          href="/invoice/new"
          className="text-indigo-400 hover:text-indigo-300 text-sm underline"
        >
          Create invoice
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="empty-filtered"
      className="text-center py-20 text-gray-400"
    >
      <p className="text-lg font-medium mb-2">No invoices found</p>
      <p className="text-sm">
        {hasFilters
          ? 'Try adjusting or clearing your filters.'
          : 'No invoices match your search.'}
      </p>
    </div>
  );
}

// ── SearchPageInner ────────────────────────────────────────────────────────────
// Must live inside a <Suspense> boundary because it calls useSearchParams().

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Applied criteria — synced to URL
  const [criteria, setCriteria] = useState<FilterCriteria>(() =>
    fromURLParams(searchParams),
  );

  // Draft state for debounced text/number inputs (display values)
  const [draftToken, setDraftToken] = useState(criteria.token ?? '');
  const [draftFundedMin, setDraftFundedMin] = useState(bigintToUsdc(criteria.fundedMin));
  const [draftFundedMax, setDraftFundedMax] = useState(bigintToUsdc(criteria.fundedMax));
  const [draftCreator, setDraftCreator] = useState(criteria.creator ?? '');
  const [draftRecipient, setDraftRecipient] = useState(criteria.recipient ?? '');

  // Share status feedback
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // Column customization
  const [visibleColumns, setVisibleColumns] = useState<SearchColumn[]>(() => loadColumns());

  const handleToggleColumn = useCallback((col: SearchColumn) => {
    setVisibleColumns((prev) => {
      const next = toggleColumn(prev, col);
      saveColumns(next);
      return next;
    });
  }, []);

  // Refs so debounce/flush callbacks always see the latest values
  const criteriaRef = useRef(criteria);
  criteriaRef.current = criteria;

  const draftRef = useRef({ token: draftToken, fundedMin: draftFundedMin, fundedMax: draftFundedMax, creator: draftCreator, recipient: draftRecipient });
  draftRef.current = { token: draftToken, fundedMin: draftFundedMin, fundedMax: draftFundedMax, creator: draftCreator, recipient: draftRecipient };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetched data
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [knownTokens, setKnownTokens] = useState<string[]>(DEFAULT_TOKENS);

  // ── Sync URL back to state on changes ──────────────────────────────────────

  const searchParamsString = searchParams.toString();
  useEffect(() => {
    const nextCriteria = fromURLParams(searchParams);
    setCriteria(nextCriteria);
    setDraftToken(nextCriteria.token ?? '');
    setDraftFundedMin(bigintToUsdc(nextCriteria.fundedMin));
    setDraftFundedMax(bigintToUsdc(nextCriteria.fundedMax));
    setDraftCreator(nextCriteria.creator ?? '');
    setDraftRecipient(nextCriteria.recipient ?? '');
  }, [searchParamsString, searchParams]);

  // ── Copy search link to clipboard ──────────────────────────────────────────

  const copySearchLink = () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setShareStatus('Copied!');
      setTimeout(() => setShareStatus(null), 2000);
    } catch (err) {
      console.error('Failed to copy search link', err);
      setShareStatus('Failed');
      setTimeout(() => setShareStatus(null), 2000);
    }
  };

  // ── URL push ───────────────────────────────────────────────────────────────

  const pushURL = useCallback(
    (c: FilterCriteria) => {
      const qs = toURLParams(c).toString();
      router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
    },
    [router],
  );

  // ── Apply criteria immediately ─────────────────────────────────────────────

  const applyCriteria = useCallback(
    (c: FilterCriteria) => {
      setCriteria(c);
      pushURL(c);
    },
    [pushURL],
  );

  // ── Clear all ──────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setCriteria({});
    setDraftToken('');
    setDraftFundedMin('');
    setDraftFundedMax('');
    setDraftCreator('');
    setDraftRecipient('');
    router.replace('/search', { scroll: false });
  }, [router]);

  // ── Flush pending debounce immediately (Enter key) ─────────────────────────

  const flushDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const d = draftRef.current;
    const next: FilterCriteria = {
      ...criteriaRef.current,
      token: d.token || undefined,
      fundedMin: usdcToBigint(d.fundedMin),
      fundedMax: usdcToBigint(d.fundedMax),
      creator: d.creator || undefined,
      recipient: d.recipient || undefined,
    };
    setCriteria(next);
    pushURL(next);
  }, [pushURL]);

  // ── Schedule debounce for text/number fields ───────────────────────────────

  const scheduleDebounce = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const d = draftRef.current;
      const next: FilterCriteria = {
        ...criteriaRef.current,
        token: d.token || undefined,
        fundedMin: usdcToBigint(d.fundedMin),
        fundedMax: usdcToBigint(d.fundedMax),
        creator: d.creator || undefined,
        recipient: d.recipient || undefined,
      };
      setCriteria(next);
      pushURL(next);
    }, DEBOUNCE_MS);
  }, [pushURL]);

  // ── Keyboard: Escape → clear all ──────────────────────────────────────────

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') clearAll();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clearAll]);

  // ── Wallet connection ──────────────────────────────────────────────────────

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setFetchError('Connect your Freighter wallet to search invoices.'),
      );
  }, []);

  // ── Fetch all invoices ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const all: Invoice[] = [];
        let offset = 0;
        while (true) {
          const batch = await (splitClient as unknown as { listInvoices: (pk: string, offset: number, limit: number) => Promise<Invoice[]> }).listInvoices(publicKey, offset, 100);
          if (!batch?.length || cancelled) break;
          all.push(...batch);
          offset += 100;
        }
        if (cancelled) return;
        setAllInvoices(all);
        const tokens = new Set<string>(DEFAULT_TOKENS);
        for (const inv of all) {
          const t = (inv as unknown as Record<string, unknown>).token;
          if (typeof t === 'string') tokens.add(t);
        }
        setKnownTokens(Array.from(tokens));
      } catch {
        if (!cancelled) setFetchError('Failed to fetch invoices.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [publicKey]);

  // ── Derived results ────────────────────────────────────────────────────────

  const results = useMemo(() => {
    const compiled = compileFilter(criteria);
    return FilterIndex.queryIndex(allInvoices, compiled);
  }, [allInvoices, criteria]);

  const filtersActive = hasActiveFilters(criteria);

  // ── Input handlers ─────────────────────────────────────────────────────────

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      flushDebounce();
    }
  };

  const toggleStatus = (status: string) => {
    const current = criteria.statuses ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    applyCriteria({ ...criteria, statuses: next.length ? next : undefined });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Search Invoices</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={copySearchLink}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 10.742l-1.956.978a3 3 0 000 5.364l1.956.978m0-7.322a3 3 0 010-5.364l1.956-.978m0 7.322a3 3 0 000 5.364l1.956.978m-1.956-6.344l6.438-3.219m0 0a3 3 0 112.684 4.478 3 3 0 01-2.684-4.478zm0 0l-6.438 3.219"
              />
            </svg>
            <span>{shareStatus || 'Share search'}</span>
          </button>
          <ColumnPicker visibleColumns={visibleColumns} onToggle={handleToggleColumn} />
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              data-testid="clear-all"
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <p className="text-red-400 mb-6" role="alert">{fetchError}</p>
      )}

      {/* Filter panel */}
      <div
        className="bg-gray-900 rounded-lg p-6 mb-8 space-y-6"
        role="search"
        aria-label="Invoice filters"
      >
        {/* Status — multi-select checkboxes */}
        <fieldset>
          <legend className="text-sm font-medium mb-3 flex items-center">
            Status
            {criteria.statuses?.length ? (
              <ClearButton
                label="Clear status filter"
                onClick={() => applyCriteria({ ...criteria, statuses: undefined })}
              />
            ) : null}
          </legend>
          <div className="flex flex-wrap gap-4">
            {STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.statuses?.includes(s) ?? false}
                  onChange={() => toggleStatus(s)}
                  className="accent-indigo-500 w-4 h-4"
                  data-testid={`status-${s.toLowerCase()}`}
                />
                <span className="text-sm">{s}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Token autocomplete */}
        <div>
          <label htmlFor="filter-token" className="block text-sm font-medium mb-2">
            Token
            {criteria.token && (
              <ClearButton
                label="Clear token filter"
                onClick={() => {
                  setDraftToken('');
                  applyCriteria({ ...criteria, token: undefined });
                }}
              />
            )}
          </label>
          <input
            id="filter-token"
            type="text"
            list="known-tokens"
            value={draftToken}
            placeholder="e.g. USDC"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            onChange={(e) => {
              setDraftToken(e.target.value);
              scheduleDebounce();
            }}
            onKeyDown={onInputKeyDown}
            data-testid="filter-token"
          />
          <datalist id="known-tokens">
            {knownTokens.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        {/* Funded range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="filter-funded-min" className="block text-sm font-medium mb-2">
              Funded Min (USDC)
              {criteria.fundedMin !== undefined && (
                <ClearButton
                  label="Clear funded min"
                  onClick={() => {
                    setDraftFundedMin('');
                    applyCriteria({ ...criteria, fundedMin: undefined });
                  }}
                />
              )}
            </label>
            <input
              id="filter-funded-min"
              type="number"
              min="0"
              step="0.01"
              value={draftFundedMin}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              onChange={(e) => {
                setDraftFundedMin(e.target.value);
                scheduleDebounce();
              }}
              onKeyDown={onInputKeyDown}
              data-testid="filter-funded-min"
            />
          </div>
          <div>
            <label htmlFor="filter-funded-max" className="block text-sm font-medium mb-2">
              Funded Max (USDC)
              {criteria.fundedMax !== undefined && (
                <ClearButton
                  label="Clear funded max"
                  onClick={() => {
                    setDraftFundedMax('');
                    applyCriteria({ ...criteria, fundedMax: undefined });
                  }}
                />
              )}
            </label>
            <input
              id="filter-funded-max"
              type="number"
              min="0"
              step="0.01"
              value={draftFundedMax}
              placeholder="∞"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              onChange={(e) => {
                setDraftFundedMax(e.target.value);
                scheduleDebounce();
              }}
              onKeyDown={onInputKeyDown}
              data-testid="filter-funded-max"
            />
          </div>
        </div>

        {/* Deadline range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="filter-deadline-from" className="block text-sm font-medium mb-2">
              Deadline From
              {criteria.deadlineFrom !== undefined && (
                <ClearButton
                  label="Clear deadline from"
                  onClick={() => applyCriteria({ ...criteria, deadlineFrom: undefined })}
                />
              )}
            </label>
            <input
              id="filter-deadline-from"
              type="date"
              value={criteria.deadlineFrom ? tsToDateStr(criteria.deadlineFrom) : ''}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              onChange={(e) =>
                applyCriteria({
                  ...criteria,
                  deadlineFrom: e.target.value ? dateStrToTs(e.target.value) : undefined,
                })
              }
              data-testid="filter-deadline-from"
            />
          </div>
          <div>
            <label htmlFor="filter-deadline-to" className="block text-sm font-medium mb-2">
              Deadline To
              {criteria.deadlineTo !== undefined && (
                <ClearButton
                  label="Clear deadline to"
                  onClick={() => applyCriteria({ ...criteria, deadlineTo: undefined })}
                />
              )}
            </label>
            <input
              id="filter-deadline-to"
              type="date"
              value={criteria.deadlineTo ? tsToDateStr(criteria.deadlineTo) : ''}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              onChange={(e) =>
                applyCriteria({
                  ...criteria,
                  deadlineTo: e.target.value ? dateStrToTs(e.target.value) : undefined,
                })
              }
              data-testid="filter-deadline-to"
            />
          </div>
        </div>

        {/* Creator address */}
        <div>
          <label htmlFor="filter-creator" className="block text-sm font-medium mb-2">
            Creator Address
            {criteria.creator && (
              <ClearButton
                label="Clear creator filter"
                onClick={() => {
                  setDraftCreator('');
                  applyCriteria({ ...criteria, creator: undefined });
                }}
              />
            )}
          </label>
          <input
            id="filter-creator"
            type="text"
            value={draftCreator}
            placeholder="G…"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
            onChange={(e) => {
              setDraftCreator(e.target.value);
              scheduleDebounce();
            }}
            onKeyDown={onInputKeyDown}
            data-testid="filter-creator"
          />
        </div>

        {/* Recipient address */}
        <div>
          <label htmlFor="filter-recipient" className="block text-sm font-medium mb-2">
            Recipient Address
            {criteria.recipient && (
              <ClearButton
                label="Clear recipient filter"
                onClick={() => {
                  setDraftRecipient('');
                  applyCriteria({ ...criteria, recipient: undefined });
                }}
              />
            )}
          </label>
          <input
            id="filter-recipient"
            type="text"
            value={draftRecipient}
            placeholder="G…"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
            onChange={(e) => {
              setDraftRecipient(e.target.value);
              scheduleDebounce();
            }}
            onKeyDown={onInputKeyDown}
            data-testid="filter-recipient"
          />
        </div>
      </div>

      {/* Results summary */}
      <div className="mb-4 text-sm text-gray-400">
        {loading ? (
          <span>Loading invoices…</span>
        ) : (
          <span>
            {results.length} result{results.length !== 1 ? 's' : ''}
            {filtersActive && allInvoices.length > 0
              ? ` (of ${allInvoices.length} total)`
              : ''}
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState hasInvoices={allInvoices.length > 0} hasFilters={filtersActive} />
      ) : (
        <VirtualList items={results} visibleColumns={visibleColumns} />
      )}
    </main>
  );
}

// ── Page root ──────────────────────────────────────────────────────────────────
// Suspense boundary is required by Next.js for useSearchParams() in client components.

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse bg-gray-800 h-8 w-48 rounded mb-8" />
          <div className="bg-gray-900 rounded-lg h-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
