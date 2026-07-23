"use client";

import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import ThemeToggle from "@/components/ThemeToggle";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

interface SimResult {
  rawXdr: string;
  decoded: unknown;
  estimatedFee: string;
}

export default function DebuggerPage() {
  if (!DEV_MODE) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">Access Denied</h1>
        <p className="text-gray-400 text-sm">This page is only available when <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_DEV_MODE=true</code>.</p>
      </main>
    );
  }

  return <DebuggerContent />;
}

function DebuggerContent() {
  const [fnName, setFnName] = useState("createInvoice");
  const [paramsJson, setParamsJson] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xdrOpen, setXdrOpen] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      let params: Record<string, unknown>;
      try {
        params = JSON.parse(paramsJson);
      } catch {
        throw new Error("Invalid JSON in parameters field.");
      }

      let simResult: SimResult;

      // as any: simulateCreateInvoice is not yet declared in the published @stellar-split/sdk types
      if (fnName === "createInvoice" && typeof (splitClient as any).simulateCreateInvoice === "function") {
        // as any: simulateCreateInvoice is not yet declared in the published @stellar-split/sdk types
        const raw = await (splitClient as any).simulateCreateInvoice(params);
        simResult = {
          rawXdr: raw?.transactionData?.toXDR?.() ?? raw?.result?.toXDR?.() ?? JSON.stringify(raw),
          decoded: raw,
          estimatedFee: raw?.minResourceFee ?? raw?.cost?.feeInstruction ?? "N/A",
        };
      } else {
        // Generic fallback: build a minimal transaction envelope and simulate it
        const { rpc } = await import("@stellar/stellar-sdk");
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
        const server = new rpc.Server(rpcUrl);
        // as any: simulateTransaction overload with plain object args is not in @stellar/stellar-sdk RPC types
        const raw = await (server as any).simulateTransaction({
          functionName: fnName,
          args: params,
        // as any: plain params object doesn't match the typed TransactionBuilder overload
        } as any);
        simResult = {
          rawXdr: raw?.transactionData?.toXDR?.() ?? JSON.stringify(raw),
          decoded: raw,
          estimatedFee: raw?.minResourceFee ?? "N/A",
        };
      }

      setResult(simResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-12">
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
          DEV
        </span>
        <h1 className="text-2xl font-bold">Contract Debugger</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-8">
        Simulate contract function calls and inspect the raw XDR response and decoded result.
        Only accessible when <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_DEV_MODE=true</code>.
      </p>

      <form onSubmit={handleSimulate} className="flex flex-col gap-5">
        <div>
          <label htmlFor="fn-name" className="block text-sm font-medium text-gray-300 mb-1">
            Function Name
          </label>
          <input
            id="fn-name"
            type="text"
            value={fnName}
            onChange={(e) => setFnName(e.target.value)}
            placeholder="e.g. createInvoice"
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="params-json" className="block text-sm font-medium text-gray-300 mb-1">
            Parameters (JSON)
          </label>
          <textarea
            id="params-json"
            value={paramsJson}
            onChange={(e) => setParamsJson(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            aria-describedby={error ? "sim-error" : undefined}
          />
        </div>

        {error && (
          <p id="sim-error" role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 self-start"
        >
          {loading ? "Simulating…" : "Simulate"}
        </button>
      </form>

      {result && (
        <div className="mt-8 flex flex-col gap-5">
          {/* Estimated Fee */}
          <div className="bg-gray-900 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estimated Fee</p>
            <p className="text-sm font-mono text-indigo-300">{result.estimatedFee}</p>
          </div>

          {/* Decoded Result */}
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Decoded Result</h2>
            <pre className="bg-gray-900 rounded-lg px-4 py-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(result.decoded, null, 2)}
            </pre>
          </div>

          {/* Raw XDR — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setXdrOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors mb-2"
              aria-expanded={xdrOpen}
            >
              <svg
                className={`w-4 h-4 transition-transform ${xdrOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Raw XDR Response
            </button>
            {xdrOpen && (
              <pre className="bg-gray-900 rounded-lg px-4 py-3 text-xs font-mono text-yellow-300 overflow-x-auto whitespace-pre-wrap break-all">
                {result.rawXdr}
              </pre>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
