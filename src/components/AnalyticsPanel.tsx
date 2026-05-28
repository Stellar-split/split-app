"use client";

import { useState } from "react";
import { formatAmount } from "@stellar-split/sdk";
import { useI18n } from "@/components/I18nProvider";
import type { Invoice } from "@stellar-split/sdk";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  invoices: Invoice[];
}

export default function AnalyticsPanel({ invoices }: Props) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // Calculate summary stats
  const stats = {
    totalSent: 0n,
    totalReceived: 0n,
    pending: 0,
    released: 0,
    refunded: 0,
  };

  invoices.forEach((inv) => {
    const total = inv.recipients.reduce((sum, r) => sum + r.amount, 0n);
    if (inv.status === "Pending") stats.pending++;
    else if (inv.status === "Released") stats.released++;
    else if (inv.status === "Refunded") stats.refunded++;

    // Count as "sent" if user is creator (funded amount), "received" if recipient
    stats.totalSent += inv.funded;
    stats.totalReceived += inv.funded;
  });

  // Group invoices by week (last 30 days)
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  const weekData: Record<string, number> = {};

  invoices.forEach((inv) => {
    if (inv.deadline >= thirtyDaysAgo) {
      const date = new Date(inv.deadline * 1000);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);

      weekData[weekKey] = (weekData[weekKey] || 0) + 1;
    }
  });

  const chartData = Object.entries(weekData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, invoices: count }));

  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left font-semibold text-lg hover:text-white transition-colors"
        aria-expanded={isOpen}
        aria-label="Toggle analytics panel"
      >
        <span>{t("dashboard.analytics")}</span>
        <span className="text-sm text-gray-400">
          {isOpen ? "▼" : "▶"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-5 space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{t("dashboard.totalSent")}</p>
              <p className="text-lg font-semibold">{formatAmount(stats.totalSent)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{t("dashboard.totalReceived")}</p>
              <p className="text-lg font-semibold">{formatAmount(stats.totalReceived)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{t("dashboard.totalInvoices")}</p>
              <p className="text-lg font-semibold">{invoices.length}</p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-xs text-yellow-300 mb-1">{t("dashboard.pending")}</p>
              <p className="text-lg font-semibold text-yellow-300">{stats.pending}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-xs text-green-300 mb-1">{t("dashboard.released")}</p>
              <p className="text-lg font-semibold text-green-300">{stats.released}</p>
            </div>
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{t("dashboard.refunded")}</p>
              <p className="text-lg font-semibold text-gray-400">{stats.refunded}</p>
            </div>
          </div>

          {/* Weekly Chart */}
          {chartData.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
              <p className="text-sm text-gray-400 mb-3">{t("dashboard.invoicesByWeek")}</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="invoices" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
