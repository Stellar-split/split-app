"use client";

import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import DataTable from "@/components/ui/DataTable";

interface TableRecipient {
  address: string;
  amount: bigint;
}

interface InvoiceTableProps {
  recipients: TableRecipient[];
  assetCode?: string;
}

export default function InvoiceTable({
  recipients,
  assetCode = "XLM",
}: InvoiceTableProps) {
  if (!recipients || recipients.length === 0) {
    return <p className="text-sm text-gray-400">No recipients</p>;
  }

  return (
    <DataTable className="text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-700">
          <th
            className="text-left px-4 py-2 font-semibold text-gray-300"
            style={{ minWidth: "120px" }}
          >
            Address
          </th>
          <th
            className="text-right px-4 py-2 font-semibold text-gray-300"
            style={{ minWidth: "100px" }}
          >
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {recipients.map((recipient, idx) => (
          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-900/50">
            <td
              className="px-4 py-3 font-mono text-gray-400 truncate"
              title={recipient.address}
              style={{ minWidth: "120px" }}
            >
              {truncateAddress(recipient.address)}
            </td>
            <td
              className="px-4 py-3 text-right text-gray-200 font-mono"
              style={{ minWidth: "100px" }}
            >
              {formatAmount(recipient.amount)} {assetCode}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
