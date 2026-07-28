"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { useI18n } from "@/components/I18nProvider";
import type { Invoice } from "@stellar-split/sdk";
import dynamic from "next/dynamic";

const LeaderboardTable = dynamic(() => import("@/components/LeaderboardTable"), { ssr: false });

type LeaderboardRow = {
  address: string;
  totalPaid: bigint;
  invoiceCount: number;
};

export default function LeaderboardPage() {
  const { t } = useI18n();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setPublicKey(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const invoiceList: Invoice[] = [];
        for (let id = 1; id <= 100; id++) {
          try {
            const inv = await splitClient.getInvoice(String(id));
            invoiceList.push(inv);
          } catch {
            // Once invoices stop existing, further calls likely fail as well.
            break;
          }
        }

        const totals = new Map<
          string,
          { totalPaid: bigint; invoiceIds: Set<string> }
        >();

        for (const inv of invoiceList) {
          for (const payment of inv.payments) {
            const address = payment.payer;
            if (!address) continue;

            const entry = totals.get(address);
            if (!entry) {
              totals.set(address, {
                totalPaid: payment.amount,
                invoiceIds: new Set([inv.id]),
              });
            } else {
              entry.totalPaid += payment.amount;
              entry.invoiceIds.add(inv.id);
            }
          }
        }

        const nextRows: LeaderboardRow[] = Array.from(totals.entries())
          .map(([address, v]) => ({
            address,
            totalPaid: v.totalPaid,
            invoiceCount: v.invoiceIds.size,
          }))
          .sort((a, b) =>
            b.totalPaid > a.totalPaid ? 1 : b.totalPaid < a.totalPaid ? -1 : 0,
          )
          .slice(0, 20);

        if (!cancelled) setRows(nextRows);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const walletRank = rows.findIndex((r) => r.address === publicKey) + 1;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-8">
        <h1 className="text-3xl font-bold">{t("leaderboard.title")}</h1>
        <div className="text-sm text-gray-400">
          {t("leaderboard.subtitle")}
        </div>
      </div>

      <LeaderboardTable rows={rows} publicKey={publicKey} loading={loading} error={error} />

      {publicKey && walletRank > 0 && (
        <p className="mt-4 text-sm text-gray-400" role="status">
          {t("leaderboard.yourRank").replace("{rank}", String(walletRank))}
          {!loading && !rows.some((r) => r.address === publicKey) && (
            <span className="text-gray-500"> {t("leaderboard.notInTop")}</span>
          )}
        </p>
      )}

      <div className="mt-8 text-sm text-gray-500">
        <Link
          href="/dashboard"
          className="text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          {t("leaderboard.backToDashboard")}
        </Link>
      </div>
    </main>
  );
}
