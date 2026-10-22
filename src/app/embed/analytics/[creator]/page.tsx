"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import EmbedThemeProvider from "@/components/EmbedThemeProvider";
import { formatAmount } from "@stellar-split/sdk";

interface AnalyticsData {
  generatedAt: number;
  summary: {
    invoiceCount: number;
    activeInvoices: number;
    paymentCount: number;
    fundedStroops: number;
    targetStroops: number;
    completionRate: number;
  };
  statuses: { name: string; value: number }[];
  daily: { date: string; fundedStroops: number }[];
}

interface Props {
  params: { creator: string };
}

const statusOptions = ["all", "Pending", "Released", "Refunded"];
const rangeOptions = ["all", "30d", "90d", "365d"];

export default function EmbedAnalyticsPage({ params }: Props) {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [range, setRange] = useState(searchParams.get("range") ?? "90d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const embedToken = fragment.get("token") ?? "";
    setToken(embedToken);
    if (!embedToken) {
      setError("This analytics embed is missing its access token.");
      setLoading(false);
    }
    if (window.location.hash) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const theme = useMemo(() => ({
    primaryColor: searchParams.get("primaryColor") ?? undefined,
    backgroundColor: searchParams.get("backgroundColor") ?? undefined,
    logoUrl: searchParams.get("logoUrl") ?? undefined,
    borderRadius: searchParams.get("borderRadius") ?? undefined,
  }), [searchParams]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ creator: params.creator, status, range });
      const parentOrigin = document.referrer ? new URL(document.referrer).origin : "";
      const response = await fetch(`/api/embed/analytics?${params}`, {
        headers: {
          "x-embed-token": token,
          ...(parentOrigin ? { "x-embed-parent-origin": parentOrigin } : {}),
        },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load analytics.");
      setData(result as AnalyticsData);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [token, status, range, params.creator]);

  useEffect(() => {
    if (token) void load();
  }, [load]);

  const maxDaily = Math.max(1, ...(data?.daily.map((item) => item.fundedStroops) ?? [0]));
  const raised = data ? BigInt(Math.max(0, Math.round(data.summary.fundedStroops))) : 0n;
  const target = data ? BigInt(Math.max(0, Math.round(data.summary.targetStroops))) : 0n;

  return (
    <EmbedThemeProvider config={theme}>
      <main className="min-h-screen p-3 text-slate-100 sm:p-5">
        <section className="mx-auto w-full max-w-3xl overflow-hidden border border-white/10 bg-slate-950/95 shadow-xl" style={{ borderRadius: "var(--embed-border-radius)" }}>
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {theme.logoUrl && <Image src={theme.logoUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" unoptimized />}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Client analytics</p>
                <h1 className="truncate text-base font-semibold text-white">Invoice portfolio</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="embed-status">Invoice status filter</label>
              <select id="embed-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 border border-white/10 bg-slate-900 px-2 text-xs text-white">
                {statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>)}
              </select>
              <label className="sr-only" htmlFor="embed-range">Date range filter</label>
              <select id="embed-range" value={range} onChange={(event) => setRange(event.target.value)} className="h-9 border border-white/10 bg-slate-900 px-2 text-xs text-white">
                {rangeOptions.map((item) => <option key={item} value={item}>{item === "all" ? "All time" : `Last ${item}`}</option>)}
              </select>
            </div>
          </header>

          {error ? (
            <p role="alert" className="px-5 py-8 text-sm text-rose-300">{error}</p>
          ) : loading || !data ? (
            <p role="status" className="px-5 py-8 text-sm text-slate-400">Loading analytics…</p>
          ) : (
            <div className="space-y-6 p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-4">
                {[
                  ["Funded", `${formatAmount(raised)} USDC`],
                  ["Invoices", data.summary.invoiceCount],
                  ["Active", data.summary.activeInvoices],
                  ["Payments", data.summary.paymentCount],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 bg-slate-950 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <section aria-label="Funding progress">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">Portfolio funding</span>
                  <span className="font-medium text-white">{data.summary.completionRate.toFixed(1)}% · {formatAmount(target)} USDC target</span>
                </div>
                <div className="h-2 overflow-hidden bg-white/10">
                  <div className="h-full transition-[width]" style={{ width: `${Math.min(100, data.summary.completionRate)}%`, backgroundColor: "var(--embed-primary-color)" }} />
                </div>
              </section>

              <section aria-labelledby="embed-trend-heading">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="embed-trend-heading" className="text-sm font-semibold text-slate-200">Funded by invoice date</h2>
                  <span className="text-[10px] text-slate-500">{data.daily.length} days</span>
                </div>
                {data.daily.length === 0 ? (
                  <p className="border-y border-white/10 py-5 text-xs text-slate-500">No invoices in this range.</p>
                ) : (
                  <div className="flex h-32 items-end gap-1 border-b border-white/10 px-1" role="img" aria-label="Daily funded amount bar chart">
                    {data.daily.slice(-30).map((item) => (
                      <div key={item.date} className="group relative flex min-w-1 flex-1 items-end justify-center" title={`${item.date}: ${formatAmount(BigInt(Math.max(0, Math.round(item.fundedStroops))))} USDC`}>
                        <div className="w-full max-w-5 transition-[height]" style={{ height: `${Math.max(2, item.fundedStroops / maxDaily * 100)}%`, backgroundColor: "var(--embed-primary-color)" }} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-label="Invoice status breakdown" className="flex flex-wrap gap-2">
                {data.statuses.map((item) => (
                  <span key={item.name} className="border border-white/10 px-2.5 py-1.5 text-xs text-slate-300">
                    <span className="mr-2 text-slate-500">{item.name}</span>{item.value}
                  </span>
                ))}
              </section>
              <p className="text-right text-[10px] text-slate-600">Updated {new Date(data.generatedAt).toLocaleTimeString()}</p>
            </div>
          )}
        </section>
      </main>
    </EmbedThemeProvider>
  );
}