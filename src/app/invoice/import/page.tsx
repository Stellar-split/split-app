"use client";

import { useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";

interface ParsedRow {
  recipient_address: string;
  amount: string;
  deadline_days: string;
  token: string;
  error?: string;
}

export default function ImportInvoicesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string[] | null>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: ParsedRow = {
        recipient_address: "",
        amount: "",
        deadline_days: "",
        token: "",
      };

      header.forEach((col, idx) => {
        if (col === "recipient_address") row.recipient_address = values[idx] || "";
        if (col === "amount") row.amount = values[idx] || "";
        if (col === "deadline_days") row.deadline_days = values[idx] || "";
        if (col === "token") row.token = values[idx] || "";
      });

      // Validate
      if (!row.recipient_address) row.error = "Missing recipient_address";
      if (!row.amount || isNaN(Number(row.amount))) row.error = "Invalid amount";
      if (!row.deadline_days || isNaN(Number(row.deadline_days))) row.error = "Invalid deadline_days";
      if (!row.token) row.error = "Missing token";

      rows.push(row);
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setError("No valid rows found in CSV");
          return;
        }
        setParsed(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(f);
  };

  const handleSubmit = async () => {
    const validRows = parsed.filter((r) => !r.error);
    if (validRows.length === 0) {
      setError("No valid rows to import");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const publicKey = await getFreighterPublicKey();
      const invoiceIds: string[] = [];

      for (const row of validRows) {
        const inv = await splitClient.createInvoice({
          creator: publicKey,
          recipients: [
            {
              address: row.recipient_address,
              amount: BigInt(Math.floor(Number(row.amount) * 1e7)),
            },
          ],
          deadline: Math.floor(Date.now() / 1000) + Number(row.deadline_days) * 86400,
          token: row.token,
        });
        invoiceIds.push(inv.id);
      }

      setSuccess(invoiceIds);
      setParsed([]);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoices");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Import Invoices</h1>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Upload CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-2">
              Expected columns: recipient_address, amount, deadline_days, token
            </p>
          </div>

          {error && <p className="text-red-600 mb-4">{error}</p>}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-800 font-semibold mb-2">
                Successfully created {success.length} invoice(s):
              </p>
              <ul className="text-sm text-green-700 space-y-1">
                {success.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {parsed.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Preview ({parsed.length} rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Recipient</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Deadline (days)</th>
                    <th className="px-4 py-2 text-left">Token</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, idx) => (
                    <tr key={idx} className={row.error ? "bg-red-50" : ""}>
                      <td className="px-4 py-2 truncate">{row.recipient_address}</td>
                      <td className="px-4 py-2">{row.amount}</td>
                      <td className="px-4 py-2">{row.deadline_days}</td>
                      <td className="px-4 py-2">{row.token}</td>
                      <td className="px-4 py-2">
                        {row.error ? (
                          <span className="text-red-600 text-xs">{row.error}</span>
                        ) : (
                          <span className="text-green-600 text-xs">✓ Valid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || parsed.filter((r) => !r.error).length === 0}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Creating..." : "Create Invoices"}
            </button>
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
