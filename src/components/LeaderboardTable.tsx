"use client";

import { useEffect, useMemo, useState } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import { useI18n } from "@/components/I18nProvider";

export type LeaderboardRow = {
  address: string;
  totalPaid: bigint;
  invoiceCount: number;
};

interface Props {
  rows: LeaderboardRow[];
  publicKey: string | null;
  loading: boolean;
  error: string | null;
}

const PAGE_SIZE = 10;

function renderRow(
  r: LeaderboardRow,
  rank: number,
  isWallet: boolean,
  t: (key: string) => string
) {
  return (
    <li
      key={r.address}
      className={
        isWallet
          ? "grid grid-cols-12 gap-2 px-4 py-4 items-center bg-indigo-600/15 border-b border-indigo-400/20"
          : "grid grid-cols-12 gap-2 px-4 py-4 items-center border-b border-gray-800 hover:bg-gray-800/50"
      }
      aria-current={isWallet ? "page" : undefined}
    >
      <div className="col-span-1 font-semibold text-gray-200">{rank}</div>
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        <span className="font-mono text-gray-300 truncate" title={r.address}>
          {truncateAddress(r.address)}
        </span>
        {isWallet && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-semibold">
            {t("leaderboard.you")}
          </span>
        )}
      </div>
      <div className="col-span-3 font-semibold text-indigo-200">
        {formatAmount(r.totalPaid)}
      </div>
      <div className="col-span-3 text-gray-300">{r.invoiceCount}</div>
    </li>
  );
}

export default function LeaderboardTable({ rows, publicKey, loading, error }: Props) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);

  const walletRank = useMemo(() => {
    if (!publicKey) return null;
    const idx = rows.findIndex((r) => r.address === publicKey);
    return idx >= 0 ? idx + 1 : null;
  }, [publicKey, rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // Reset to page 1 whenever the underlying data set changes.
  useEffect(() => {
    setPage(1);
  }, [rows]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  const walletOnPage =
    walletRank !== null && walletRank > pageStart && walletRank <= pageStart + PAGE_SIZE;
  const walletRow =
    walletRank !== null && !walletOnPage ? rows[walletRank - 1] : null;

  if (error) {
    return (
      <div
        role="alert"
        className="bg-red-950/40 border border-red-900 text-red-300 rounded-xl px-4 py-3 mb-6"
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="h-6 bg-gray-800 rounded mb-3" aria-hidden="true" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-8 h-5 bg-gray-800 rounded" aria-hidden="true" />
            <div className="flex-1 h-5 bg-gray-800 rounded" aria-hidden="true" />
            <div className="w-28 h-5 bg-gray-800 rounded" aria-hidden="true" />
            <div className="w-24 h-5 bg-gray-800 rounded" aria-hidden="true" />
          </div>
        ))}
        <div className="h-3 bg-gray-800 rounded" aria-hidden="true" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="text-gray-400">{t("leaderboard.noPayments")}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px] bg-gray-900 rounded-xl border border-gray-800">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-gray-500 border-b border-gray-800">
          <div className="col-span-1">{t("leaderboard.rank")}</div>
          <div className="col-span-5">{t("leaderboard.address")}</div>
          <div className="col-span-3">{t("leaderboard.totalUsdc")}</div>
          <div className="col-span-3">{t("leaderboard.invoices")}</div>
        </div>

        {/* Sticky reminder of the user's own rank when it falls outside the current page */}
        {walletRow && walletRank !== null && (
          <ul className="sticky top-0 z-10">
            {renderRow(walletRow, walletRank, true, t)}
          </ul>
        )}

        <ul>
          {pageRows.map((r, idx) => {
            const rank = pageStart + idx + 1;
            const isWallet = Boolean(publicKey && r.address === publicKey);
            return renderRow(r, rank, isWallet, t);
          })}
        </ul>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm text-gray-400">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("leaderboard.previous") || "Previous"}
            </button>
            <span>
              {t("leaderboard.page") || "Page"} {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("leaderboard.next") || "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
