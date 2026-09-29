"use client";

import { useMemo } from "react";
import {
  summarizeInvoiceSecurity,
  type InvoiceSecurityEvent,
  type SecurityEventKind,
  type SecurityLevel,
} from "@/lib/invoiceSecurity";
import type { ActivityEvent } from "@/lib/suspiciousActivity";
import SuspiciousActivityAlerts from "@/components/security/SuspiciousActivityAlerts";

const LEVEL_LABEL: Record<SecurityLevel, string> = {
  good: "Good",
  attention: "Needs attention",
  at_risk: "At risk",
};
const LEVEL_STYLE: Record<SecurityLevel, string> = {
  good: "border-green-300 bg-green-50 text-green-800",
  attention: "border-amber-300 bg-amber-50 text-amber-800",
  at_risk: "border-red-300 bg-red-50 text-red-800",
};
const KIND_LABEL: Record<SecurityEventKind, string> = {
  failed_auth: "Failed sign-ins",
  permission_change: "Permission changes",
  large_payment: "Large payments",
  link_shared: "Links shared",
  export: "Exports",
};

interface Props {
  events: InvoiceSecurityEvent[];
  activity?: ActivityEvent[];
}

export default function InvoiceSecurityDashboard({ events, activity = [] }: Props) {
  const summary = useMemo(() => summarizeInvoiceSecurity(events, activity), [events, activity]);

  return (
    <section className="space-y-6" aria-label="Invoice security dashboard">
      <div className={`rounded border p-4 ${LEVEL_STYLE[summary.level]}`} role="status">
        <p className="text-sm">Security score</p>
        <p className="text-3xl font-semibold tabular-nums">{summary.score}</p>
        <p className="font-medium">{LEVEL_LABEL[summary.level]}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(KIND_LABEL) as SecurityEventKind[]).map((kind) => (
          <div key={kind} className="rounded border p-3">
            <dt className="text-xs text-gray-500">{KIND_LABEL[kind]}</dt>
            <dd className="text-xl font-semibold tabular-nums">{summary.countsByKind[kind]}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="mb-2 font-semibold">Highest-risk invoices</h2>
        {summary.riskiestInvoices.length === 0 ? (
          <p className="text-sm text-gray-500">No security events recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-1 pr-4 font-medium">Invoice</th>
                  <th className="py-1 pr-4 font-medium">Events</th>
                  <th className="py-1 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {summary.riskiestInvoices.map((row) => (
                  <tr key={row.invoiceId} className="border-b">
                    <td className="py-1 pr-4">{row.invoiceId}</td>
                    <td className="py-1 pr-4 tabular-nums">{row.events}</td>
                    <td className="py-1 tabular-nums">{row.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Suspicious activity</h2>
        <SuspiciousActivityAlerts events={activity} />
      </div>
    </section>
  );
}
