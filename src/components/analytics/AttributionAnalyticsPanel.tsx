"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareAttributionModels,
  getPaymentConversions,
  getPaymentTouchpoints,
  summarizeAttribution,
  type AttributionModel,
  type PaymentConversion,
  type PaymentTouchpoint,
} from "@/lib/paymentAttribution";

const MODEL_LABELS: Record<AttributionModel, string> = {
  "first-touch": "First touch",
  "last-touch": "Last touch",
  linear: "Linear",
  "position-based": "Position based",
  "time-decay": "Time decay (7 days)",
};

function formatRevenue(amount: number): string {
  return `${amount.toFixed(2)} USDC`;
}

export default function AttributionAnalyticsPanel() {
  const [model, setModel] = useState<AttributionModel>("last-touch");
  const [touchpoints, setTouchpoints] = useState<PaymentTouchpoint[]>([]);
  const [conversions, setConversions] = useState<PaymentConversion[]>([]);

  useEffect(() => {
    const refresh = () => {
      setTouchpoints(getPaymentTouchpoints());
      setConversions(getPaymentConversions());
    };
    refresh();
    window.addEventListener("payment-attribution-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("payment-attribution-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const comparison = useMemo(
    () => compareAttributionModels(conversions, touchpoints),
    [conversions, touchpoints],
  );
  const summary = useMemo(
    () => summarizeAttribution(conversions, touchpoints, model),
    [conversions, touchpoints, model],
  );
  const touchpointCounts = useMemo(() => {
    const counts = new Map<string, number>();
    touchpoints.forEach(({ channel }) => counts.set(channel, (counts.get(channel) ?? 0) + 1));
    return counts;
  }, [touchpoints]);
  const sourceBreakdown = useMemo(() => {
    const rows = new Map<string, { source: string; medium: string; campaign: string; channel: string; count: number; latest: number }>();
    touchpoints.forEach((touchpoint) => {
      const source = touchpoint.source || touchpoint.channel;
      const medium = touchpoint.medium || "—";
      const campaign = touchpoint.campaign || "—";
      const key = `${source}|${medium}|${campaign}|${touchpoint.channel}`;
      const current = rows.get(key) ?? {
        source,
        medium,
        campaign,
        channel: touchpoint.channel,
        count: 0,
        latest: 0,
      };
      current.count += 1;
      current.latest = Math.max(current.latest, touchpoint.timestamp);
      rows.set(key, current);
    });
    return Array.from(rows.values()).sort((a, b) => b.count - a.count || b.latest - a.latest);
  }, [touchpoints]);

  return (
    <section aria-labelledby="payment-attribution-heading" className="mb-8 border-y border-gray-800 py-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Channel performance</p>
          <h2 id="payment-attribution-heading" className="mt-1 text-xl font-semibold text-white">Payment attribution</h2>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Attribution model
          <select
            value={model}
            onChange={(event) => setModel(event.target.value as AttributionModel)}
            className="min-h-10 border border-gray-700 bg-gray-900 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
          >
            {Object.entries(MODEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-l-2 border-emerald-500 bg-gray-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Confirmed payments</p>
          <p className="mt-1 text-xl font-semibold text-white">{summary.totalConversions}</p>
        </div>
        <div className="border-l-2 border-cyan-500 bg-gray-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Credited revenue</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatRevenue(summary.totalRevenue)}</p>
        </div>
        <div className="border-l-2 border-amber-500 bg-gray-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Touchpoints</p>
          <p className="mt-1 text-xl font-semibold text-white">{touchpoints.length}</p>
        </div>
        <div className="border-l-2 border-rose-500 bg-gray-900/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Channels</p>
          <p className="mt-1 text-xl font-semibold text-white">{touchpointCounts.size}</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-200">Credited by channel · {MODEL_LABELS[model]}</h3>
          {summary.channels.length === 0 ? (
            <p className="border-y border-gray-800 py-6 text-sm text-gray-500">Confirmed payments and their touchpoints will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[430px] text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Channel</th>
                    <th className="py-2 pr-3 text-right font-medium">Touchpoints</th>
                    <th className="py-2 pr-3 text-right font-medium">Conversions</th>
                    <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                    <th className="py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.channels.map((channel) => (
                    <tr key={channel.channel} className="border-b border-gray-800/70 text-gray-300">
                      <td className="py-2.5 pr-3 font-medium text-white">{channel.channel}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-400">{touchpointCounts.get(channel.channel) ?? 0}</td>
                      <td className="py-2.5 pr-3 text-right">{channel.attributedConversions.toFixed(2)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatRevenue(channel.attributedRevenue)}</td>
                      <td className="py-2.5 text-right">{channel.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-200">Model comparison</h3>
          {comparison.every((item) => item.totalConversions === 0) ? (
            <p className="border-y border-gray-800 py-6 text-sm text-gray-500">Models compare channel credit after the first confirmed payment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[390px] text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Model</th>
                    <th className="py-2 pr-3 font-medium">Top channel</th>
                    <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                    <th className="py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((item) => {
                    const topChannel = item.channels[0];
                    return (
                      <tr key={item.model} className={`border-b border-gray-800/70 ${item.model === model ? "bg-emerald-950/20 text-white" : "text-gray-300"}`}>
                        <td className="py-2.5 pr-3">{MODEL_LABELS[item.model]}</td>
                        <td className="py-2.5 pr-3">{topChannel?.channel ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right">{topChannel ? formatRevenue(topChannel.attributedRevenue) : "—"}</td>
                        <td className="py-2.5 text-right">{topChannel ? `${topChannel.share.toFixed(1)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="mt-7">
        <h3 className="mb-3 text-sm font-semibold text-gray-200">Touchpoint source analysis</h3>
        {sourceBreakdown.length === 0 ? (
          <p className="border-y border-gray-800 py-5 text-sm text-gray-500">Campaign and referrer details appear after invoice visits.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Medium</th>
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 pr-3 font-medium">Channel</th>
                  <th className="py-2 pr-3 text-right font-medium">Touches</th>
                  <th className="py-2 text-right font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.slice(0, 10).map((row) => (
                  <tr key={`${row.source}|${row.medium}|${row.campaign}|${row.channel}`} className="border-b border-gray-800/70 text-gray-300">
                    <td className="py-2.5 pr-3">{row.source}</td>
                    <td className="py-2.5 pr-3 text-gray-400">{row.medium}</td>
                    <td className="py-2.5 pr-3 text-gray-400">{row.campaign}</td>
                    <td className="py-2.5 pr-3">{row.channel}</td>
                    <td className="py-2.5 pr-3 text-right">{row.count}</td>
                    <td className="py-2.5 text-right text-gray-400">{new Date(row.latest).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-gray-500">Revenue is allocated across touchpoints preceding each confirmed payment. Time decay uses a seven-day half-life.</p>
    </section>
  );
}