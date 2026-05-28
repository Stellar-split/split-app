"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Invoice } from "@stellar-split/sdk";

interface WeeklyData {
  week: string;
  count: number;
}

interface RecipientData {
  address: string;
  count: number;
}

export default function AnalyticsPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view analytics."));
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const results: Invoice[] = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const batch = await splitClient.getInvoicesByCreator(publicKey, offset, limit);
          if (batch.length === 0) break;
          results.push(...batch);
          offset += limit;
        }

        setInvoices(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [publicKey]);

  const analytics = useMemo(() => {
    if (invoices.length === 0) {
      return {
        weeklyData: [],
        successRate: 0,
        avgFundingTime: 0,
        topRecipients: [],
      };
    }

    // Weekly data (last 12 weeks)
    const now = Math.floor(Date.now() / 1000);
    const weeklyMap = new Map<number, number>();

    for (let i = 0; i < 12; i++) {
      const weekStart = now - (12 - i) * 7 * 86400;
      weeklyMap.set(weekStart, 0);
    }

    invoices.forEach((inv) => {
      const weekStart = Math.floor((inv.createdAt - now) / (7 * 86400)) * 7 * 86400 + now;
      if (weeklyMap.has(weekStart)) {
        weeklyMap.set(weekStart, (weeklyMap.get(weekStart) || 0) + 1);
      }
    });

    const weeklyData: WeeklyData[] = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, count]) => ({
        week: new Date(timestamp * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count,
      }));

    // Success rate
    const released = invoices.filter((inv) => inv.status === "Released").length;
    const successRate = invoices.length > 0 ? (released / invoices.length) * 100 : 0;

    // Average funding time
    const releasedInvoices = invoices.filter((inv) => inv.status === "Released");
    const avgFundingTime =
      releasedInvoices.length > 0
        ? releasedInvoices.reduce((sum, inv) => sum + (inv.deadline - inv.createdAt), 0) /
          releasedInvoices.length /
          86400
        : 0;

    // Top recipients
    const recipientMap = new Map<string, number>();
    invoices.forEach((inv) => {
      inv.recipients.forEach((r) => {
        recipientMap.set(r.address, (recipientMap.get(r.address) || 0) + 1);
      });
    });

    const topRecipients: RecipientData[] = Array.from(recipientMap.entries())
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { weeklyData, successRate, avgFundingTime, topRecipients };
  }, [invoices]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Analytics</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Invoices</p>
            <p className="text-3xl font-bold">{invoices.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Success Rate</p>
            <p className="text-3xl font-bold">{analytics.successRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Avg Funding Time</p>
            <p className="text-3xl font-bold">{analytics.avgFundingTime.toFixed(1)} days</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Weekly Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Invoices per Week (Last 12 Weeks)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Recipients */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Top 5 Recipients</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topRecipients}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="address" width={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recipients Table */}
        {analytics.topRecipients.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">Top Recipients</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Address</th>
                    <th className="px-4 py-2 text-left">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topRecipients.map((recipient) => (
                    <tr key={recipient.address} className="border-t">
                      <td className="px-4 py-2 truncate">{recipient.address}</td>
                      <td className="px-4 py-2">{recipient.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
