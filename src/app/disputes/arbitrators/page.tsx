"use client";

import { useState } from "react";
import { searchArbitrators } from "@/lib/arbitrators";
import type { Arbitrator } from "@/lib/arbitrators";

export default function ArbitratorsPage() {
  const [query, setQuery] = useState("");
  const results: Arbitrator[] = searchArbitrators(query);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Arbitrator Marketplace</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or address…"
        className="w-full mb-6 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {results.length === 0 ? (
        <p className="text-gray-400 text-sm">No arbitrators registered yet.</p>
      ) : (
        <ul className="space-y-3">
          {results.map((arb) => (
            <li
              key={arb.address}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-1"
            >
              <span className="font-semibold">{arb.name}</span>
              <span className="text-xs text-gray-400 font-mono break-all">
                {arb.address}
              </span>
              <span className="text-sm text-gray-300">
                {arb.resolvedDisputeCount !== null
                  ? `${arb.resolvedDisputeCount} disputes resolved`
                  : "No history yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
