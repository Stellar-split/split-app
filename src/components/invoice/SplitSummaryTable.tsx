"use client";

import { truncateAddress } from "@stellar-split/sdk";
import DataTable from "@/components/ui/DataTable";

interface SplitRecipient {
  address: string;
  sharePercent: number;
  grossAmount: number;
  effectiveTaxAmount: number;
  netAmount: number;
}

interface SplitSummaryTableProps {
  lines: SplitRecipient[];
  assetCode?: string;
}

function formatAmount(value: number): string {
  return value.toFixed(7);
}

export default function SplitSummaryTable({
  lines,
  assetCode = "USDC",
}: SplitSummaryTableProps) {
  if (!lines || lines.length === 0) {
    return <p className="text-sm text-gray-400">No split lines</p>;
  }

  return (
    <DataTable className="text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-700">
          <th
            className="text-left px-4 py-2 font-semibold text-gray-300"
            style={{ minWidth: "120px" }}
          >
            Recipient
          </th>
          <th
            className="text-center px-4 py-2 font-semibold text-gray-300"
            style={{ minWidth: "80px" }}
          >
            Share %
          </th>
          <th
            className="text-right px-4 py-2 font-semibold text-gray-300"
            style={{ minWidth: "100px" }}
          >
            Gross
          </th>
          <th
            className="text-right px-4 py-2 font-semibold text-orange-400"
            style={{ minWidth: "100px" }}
          >
            Tax
          </th>
          <th
            className="text-right px-4 py-2 font-semibold text-indigo-300"
            style={{ minWidth: "100px" }}
          >
            Net
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-900/50">
            <td
              className="px-4 py-3 font-mono text-gray-400 truncate"
              title={line.address}
              style={{ minWidth: "120px" }}
            >
              {truncateAddress(line.address)}
            </td>
            <td
              className="px-4 py-3 text-center text-gray-200 font-mono"
              style={{ minWidth: "80px" }}
            >
              {line.sharePercent.toFixed(2)}%
            </td>
            <td
              className="px-4 py-3 text-right text-gray-200 font-mono"
              style={{ minWidth: "100px" }}
            >
              {formatAmount(line.grossAmount)} {assetCode}
            </td>
            <td
              className="px-4 py-3 text-right text-orange-400 font-mono"
              style={{ minWidth: "100px" }}
            >
              -{formatAmount(line.effectiveTaxAmount)} {assetCode}
            </td>
            <td
              className="px-4 py-3 text-right text-indigo-300 font-mono"
              style={{ minWidth: "100px" }}
            >
              {formatAmount(line.netAmount)} {assetCode}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
