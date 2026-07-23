"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

type InspectData = {
  invoice: Invoice;
  wasmHash: string | null;
  storageKey: string;
};

function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function JsonBlock({ data }: { data: unknown }) {
  const json = JSON.stringify(data, replacer, 2);

  function highlight(raw: string) {
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
        let cls = "text-yellow-300"; // number
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "text-indigo-300" : "text-green-300"; // key or string
        } else if (/true|false/.test(match)) {
          cls = "text-blue-300";
        } else if (/null/.test(match)) {
          cls = "text-gray-500";
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }

  return (
    <pre
      className="bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed"
      dangerouslySetInnerHTML={{ __html: highlight(json) }}
    />
  );
}

function CopyButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify(data, replacer, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 transition-colors"
    >
      {copied ? "✓ Copied" : "Copy JSON"}
    </button>
  );
}

async function fetchWasmHash(contractId: string, rpcUrl: string): Promise<string | null> {
  try {
    const { xdr, rpc, StrKey } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(rpcUrl, { allowHttp: true });
    // as any: ScAddress property name differs across stellar-sdk versions; check both casing variants
    const ScAddress = (xdr as any).ScAddress ?? (xdr as any).scAddress;
    const contractKey = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: ScAddress
          ? new ScAddress({ type: xdr.ScAddressType.scAddressTypeContract(), contractId: StrKey.decodeContract(contractId) })
          // as any: ScAddress property name differs across stellar-sdk versions
          : (xdr as any).ScAddress.contract(StrKey.decodeContract(contractId)),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );
    const result = await server.getLedgerEntries(contractKey);
    const entry = result.entries?.[0];
    if (!entry) return null;
    const data = entry.val.contractData().val();
    if (data.switch() !== xdr.ScValType.scvContractInstance()) return null;
    const instance = data.instance();
    const wasmHash = instance.executable().wasmHash();
    return wasmHash ? Buffer.from(wasmHash).toString("hex") : null;
  } catch {
    return null;
  }
}

export default function InspectPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<InspectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invoice = await splitClient.getInvoice(id);
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
      const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
      const wasmHash = await fetchWasmHash(contractId, rpcUrl);
      const storageKey = `Invoice:${id}`;
      setData({ invoice, wasmHash, storageKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!DEV_MODE) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-red-400 text-sm">Dev mode is disabled. Set <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_DEV_MODE=true</code> to access this page.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">DEV MODE</span>
        <h1 className="text-xl font-bold">Contract Inspector — Invoice #{id}</h1>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      {data && (
        <div className="flex flex-col gap-6">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-300">Invoice JSON</h2>
              <CopyButton data={data.invoice} />
            </div>
            <JsonBlock data={data.invoice} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Contract WASM Hash</h2>
            <p className="font-mono text-xs break-all bg-gray-900 rounded-lg px-4 py-3 text-green-300">
              {data.wasmHash ?? <span className="text-gray-500">unavailable</span>}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Storage Key</h2>
            <p className="font-mono text-xs bg-gray-900 rounded-lg px-4 py-3 text-indigo-300">
              {data.storageKey}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
