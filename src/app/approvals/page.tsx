"use client";

import { useCallback, useEffect, useState } from "react";
import { getApprovalRequests, type InvoiceApprovalRequest } from "@/lib/invoiceApprovals";

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<InvoiceApprovalRequest[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await getApprovalRequests();
    setRequests(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      setWallet(null);
      await refresh();
    };
    init();
  }, [refresh]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-700 pb-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">Invoice governance</p>
          <h1 className="text-3xl font-bold text-white">Approvals</h1>
        </div>
        <p className="text-sm text-slate-400">{wallet ? `${wallet.slice(0, 8)}...${wallet.slice(-6)}` : "Wallet not connected"}</p>
      </header>

      <p className="text-slate-400">Approvals dashboard coming soon...</p>
      <p className="mt-4 text-xs text-slate-500">Requests loaded: {requests.length}</p>
    </main>
  );
}
