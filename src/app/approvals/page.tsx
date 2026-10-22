"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CircleDollarSign, Clock3, Plus, X } from "lucide-react";
import { getFreighterPublicKey } from "@/lib/freighter";
import { splitClient } from "@/lib/stellar";
import { apiFetch } from "@/lib/apiClient";
import { parseAmount } from "@stellar-split/sdk";
import { useInvoiceTags } from "@/hooks/useInvoiceTags";
import {
  completeApprovalRequest,
  getApprovalPolicy,
  getApprovalRequests,
  notifyApprovalUsers,
  recordApprovalDecision,
  saveApprovalPolicy,
  saveApprovalRequests,
  summarizeApprovalAnalytics,
  type ApprovalPolicy,
  type InvoiceApprovalRequest,
} from "@/lib/invoiceApprovals";

const emptyPolicy: ApprovalPolicy = { enabled: false, minimumAmount: 1000, levels: [[""]] };

function shorten(address: string): string {
  return address.length > 18 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState<string | null>(null);
  const [policy, setPolicy] = useState<ApprovalPolicy>(emptyPolicy);
  const [requests, setRequests] = useState<InvoiceApprovalRequest[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [changeInvoiceId, setChangeInvoiceId] = useState("");
  const [changeAmount, setChangeAmount] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const requestedId = searchParams.get("request");
  const { saveTags } = useInvoiceTags();

  const refresh = useCallback(() => setRequests(getApprovalRequests()), []);

  useEffect(() => {
    getFreighterPublicKey()
      .then((address) => {
        setWallet(address);
        setPolicy(getApprovalPolicy(address) ?? emptyPolicy);
      })
      .catch(() => setError("Connect your wallet to manage approval workflows."));
    refresh();
    window.addEventListener("invoice-approvals-updated", refresh);
    return () => window.removeEventListener("invoice-approvals-updated", refresh);
  }, [refresh]);

  const visibleRequests = useMemo(
    () => requests.filter((request) =>
      request.owner === wallet || request.levels.some((level) => level.approvers.includes(wallet ?? "")),
    ).sort((a, b) => b.updatedAt - a.updatedAt),
    [requests, wallet],
  );
  const selectedRequest = visibleRequests.find((request) => request.id === requestedId) ?? visibleRequests[0];
  const analytics = summarizeApprovalAnalytics(visibleRequests);
  const mayDecide = Boolean(
    wallet && selectedRequest?.status === "pending" &&
    selectedRequest.levels[selectedRequest.currentLevel]?.approvers.includes(wallet) &&
    !selectedRequest.levels[selectedRequest.currentLevel]?.decisions.some((item) => item.approver === wallet),
  );

  const updateLevel = (index: number, value: string) => {
    setPolicy((current) => ({
      ...current,
      levels: current.levels.map((level, levelIndex) =>
        levelIndex === index ? value.split("\n").map((address) => address.trim()) : level,
      ),
    }));
  };

  const savePolicy = () => {
    if (!wallet) return;
    const levels = policy.levels
      .map((level) => [...new Set(level.map((address) => address.trim()).filter(Boolean))])
      .filter((level) => level.length > 0);
    if (policy.enabled && levels.length === 0) {
      setError("Add at least one approver before enabling this workflow.");
      return;
    }
    if (levels.some((level) => level.includes(wallet))) {
      setError("The invoice creator cannot approve their own request.");
      return;
    }
    const next = { ...policy, minimumAmount: Math.max(0, Number(policy.minimumAmount) || 0), levels };
    saveApprovalPolicy(wallet, next);
    setPolicy(next);
    setError("");
    setNotice("Approval policy saved.");
  };

  const decide = (decision: "approved" | "rejected") => {
    if (!wallet || !selectedRequest) return;
    try {
      const updated = recordApprovalDecision(selectedRequest, wallet, decision, comment);
      saveApprovalRequests(requests.map((request) => request.id === updated.id ? updated : request));
      if (updated.status === "pending" && updated.currentLevel !== selectedRequest.currentLevel) {
        notifyApprovalUsers(
          updated,
          updated.levels[updated.currentLevel]?.approvers ?? [],
          `Approval requested for ${updated.title} (level ${updated.currentLevel + 1})`,
        );
      } else if (updated.status === "approved" || updated.status === "rejected") {
        notifyApprovalUsers(updated, [updated.owner], `Invoice approval ${updated.status}: ${updated.title}`);
      }
      setComment("");
      setError("");
      setNotice(`Request ${decision}.`);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to record this decision.");
    }
  };

  const finalizeCreation = async () => {
    if (!wallet || !selectedRequest?.payload) return;
    setSaving(true);
    setError("");
    try {
      if (selectedRequest.owner !== wallet) throw new Error("Only the request owner can create this invoice.");
      const payload = selectedRequest.payload;
      const recipients = payload.recipients.map((recipient) => ({
        address: recipient.address,
        amount: parseAmount(recipient.amount),
      }));
      const result = payload.cloneSourceId
        ? await (splitClient as any).cloneInvoice({
            creator: wallet,
            sourceInvoiceId: payload.cloneSourceId,
            recipients,
            token: payload.token,
            deadline: payload.deadline,
          })
        : await splitClient.createInvoice({
            creator: wallet,
            recipients,
            token: payload.token,
            deadline: payload.deadline,
            ...(payload.recurring ? { recurring: payload.recurring, intervalDays: payload.intervalDays } : {}),
          });

      if (payload.splitMeta) {
        await apiFetch(`/api/invoices/${result.invoiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-wallet-public-key": wallet },
          body: JSON.stringify({ splitMeta: payload.splitMeta }),
        }).catch(() => null);
      }
      if (payload.tags?.length) {
        await saveTags(result.invoiceId, payload.tags).catch(() => null);
      }
      const completed = completeApprovalRequest(selectedRequest, wallet, result.invoiceId, result.txHash);
      saveApprovalRequests(requests.map((request) => request.id === completed.id ? completed : request));
      notifyApprovalUsers(completed, [wallet], `Approved invoice created: ${completed.title}`);
      setNotice(`Invoice #${result.invoiceId} created.`);
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : "Invoice creation failed.");
    } finally {
      setSaving(false);
    }
  };

  const submitModification = () => {
    if (!wallet || !changeInvoiceId.trim() || !changeSummary.trim()) {
      setError("Enter an invoice ID and a summary of the requested change.");
      return;
    }
    const amount = Number(changeAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid invoice amount for conditional routing.");
      return;
    }
    const recipients = policy.levels
      .map((level) => [...new Set(level.map((address) => address.trim()).filter(Boolean))])
      .filter((level) => level.length > 0);
    if (!policy.enabled || amount < policy.minimumAmount || recipients.length === 0) {
      setError("Modification requests must meet the enabled approval policy threshold.");
      return;
    }
    const now = Date.now();
    const request: InvoiceApprovalRequest = {
      id: `mod-${now}-${Math.random().toString(36).slice(2, 8)}`,
      owner: wallet,
      kind: "modification",
      invoiceId: changeInvoiceId.trim(),
      title: `Modification for invoice #${changeInvoiceId.trim()}`,
      amount,
      changeSummary: changeSummary.trim(),
      status: "pending",
      currentLevel: 0,
      levels: recipients.map((approvers) => ({ approvers, decisions: [] })),
      events: [{ id: `event-${now}`, actor: wallet, action: "submitted", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    };
    saveApprovalRequests([request, ...requests]);
    notifyApprovalUsers(request, recipients[0], `Modification approval requested for invoice #${request.invoiceId}`);
    setChangeInvoiceId("");
    setChangeAmount("");
    setChangeSummary("");
    setError("");
    setNotice("Modification request submitted for approval.");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-700 pb-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">Invoice governance</p>
          <h1 className="text-3xl font-bold text-white">Approvals</h1>
        </div>
        <p className="text-sm text-slate-400">{wallet ? shorten(wallet) : "Wallet not connected"}</p>
      </header>

      {error && <p role="alert" className="mb-4 border-l-2 border-red-400 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mb-4 border-l-2 border-emerald-400 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{notice}</p>}

      <section aria-label="Approval analytics" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Requests", analytics.total],
          ["Pending", analytics.pending],
          ["Approved", analytics.approved],
          ["Rejected", analytics.rejected],
          ["Avg. decision", `${analytics.averageDecisionHours.toFixed(1)}h`],
        ].map(([label, value]) => (
          <div key={label} className="border-t-2 border-emerald-500/70 bg-slate-900/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>
      <p className="-mt-5 mb-8 text-xs text-slate-500">Approval rate: {analytics.approvalRate.toFixed(0)}%</p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section aria-labelledby="request-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="request-heading" className="text-lg font-semibold text-white">Requests</h2>
            <span className="text-xs text-slate-500">{visibleRequests.length} total</span>
          </div>
          {visibleRequests.length === 0 ? (
            <p className="border-y border-slate-800 py-8 text-sm text-slate-400">No requests yet.</p>
          ) : (
            <div className="divide-y divide-slate-800 border-y border-slate-800">
              {visibleRequests.map((request) => (
                <a
                  key={request.id}
                  href={`/approvals?request=${encodeURIComponent(request.id)}`}
                  className={`block py-4 ${request.id === selectedRequest?.id ? "border-l-2 border-emerald-400 pl-3" : "pl-4"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-slate-100">{request.title}</h3>
                    <span className={`text-xs uppercase tracking-wide ${request.status === "pending" ? "text-amber-300" : request.status === "rejected" ? "text-red-300" : "text-emerald-300"}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {request.kind} · {request.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </a>
              ))}
            </div>
          )}

          {selectedRequest && (
            <article className="mt-6 border-t border-slate-700 pt-5" aria-label="Approval request details">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-400">{selectedRequest.kind} request</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{selectedRequest.title}</h2>
                </div>
                <CircleDollarSign className="mt-1 text-emerald-400" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm text-slate-300">Amount {selectedRequest.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              {selectedRequest.changeSummary && <p className="mt-3 border-l-2 border-slate-600 pl-3 text-sm text-slate-300">{selectedRequest.changeSummary}</p>}
              <ol className="mt-5 space-y-3" aria-label="Approval levels">
                {selectedRequest.levels.map((level, index) => (
                  <li key={`${selectedRequest.id}-${index}`} className="border-l border-slate-700 pl-4">
                    <p className={`text-sm font-medium ${selectedRequest.currentLevel === index && selectedRequest.status === "pending" ? "text-amber-200" : "text-slate-300"}`}>
                      Level {index + 1}{selectedRequest.currentLevel === index && selectedRequest.status === "pending" ? " · current" : ""}
                    </p>
                    {level.approvers.map((approver) => {
                      const decision = level.decisions.find((item) => item.approver === approver);
                      return (
                        <p key={approver} className="mt-1 text-xs text-slate-400">
                          {shorten(approver)}{decision ? ` · ${decision.decision}` : " · awaiting"}
                          {decision?.comment ? ` · “${decision.comment}”` : ""}
                        </p>
                      );
                    })}
                  </li>
                ))}
              </ol>
              <div className="mt-6 border-t border-slate-800 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">History</h3>
                <ol className="space-y-2">
                  {selectedRequest.events.map((event) => (
                    <li key={event.id} className="flex gap-2 text-xs text-slate-400">
                      <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{new Date(event.timestamp).toLocaleString()} · {shorten(event.actor)} · {event.action}{event.comment ? ` · ${event.comment}` : ""}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {mayDecide && (
                <div className="mt-5">
                  <label htmlFor="approval-comment" className="mb-1 block text-xs font-medium text-slate-300">Decision note</label>
                  <textarea id="approval-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={2} className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none" />
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => decide("approved")} className="inline-flex items-center gap-2 bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Check size={16} />Approve</button>
                    <button type="button" onClick={() => decide("rejected")} className="inline-flex items-center gap-2 border border-red-800 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-950/50"><X size={16} />Reject</button>
                  </div>
                </div>
              )}
              {selectedRequest.status === "approved" && selectedRequest.kind === "creation" && selectedRequest.owner === wallet && (
                <button type="button" onClick={finalizeCreation} disabled={saving} className="mt-5 inline-flex items-center gap-2 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                  <Check size={16} />{saving ? "Waiting for wallet…" : "Create approved invoice"}
                </button>
              )}
            </article>
          )}
        </section>

        <aside className="space-y-8">
          <section aria-labelledby="policy-heading" className="border-t-2 border-slate-600 pt-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="policy-heading" className="text-lg font-semibold text-white">Routing policy</h2>
                <p className="mt-1 text-xs text-slate-400">Applies to invoices at or above the threshold.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} className="accent-emerald-500" />
                Enabled
              </label>
            </div>
            <label htmlFor="approval-minimum" className="mb-1 block text-xs font-medium text-slate-300">Minimum amount</label>
            <input id="approval-minimum" type="number" min="0" step="any" value={policy.minimumAmount} onChange={(event) => setPolicy({ ...policy, minimumAmount: Number(event.target.value) })} className="mb-4 w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <div className="space-y-4">
              {policy.levels.map((level, index) => (
                <div key={index}>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor={`approval-level-${index}`} className="text-xs font-medium text-slate-300">Level {index + 1} approvers</label>
                    {policy.levels.length > 1 && <button type="button" onClick={() => setPolicy({ ...policy, levels: policy.levels.filter((_, item) => item !== index) })} aria-label={`Remove level ${index + 1}`} className="p-1 text-slate-400 hover:text-red-300"><X size={15} /></button>}
                  </div>
                  <textarea id={`approval-level-${index}`} value={level.join("\n")} onChange={(event) => updateLevel(index, event.target.value)} rows={2} placeholder="One Stellar public key per line" className="w-full border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPolicy({ ...policy, levels: [...policy.levels, [""]] })} className="inline-flex items-center gap-1.5 border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Plus size={14} />Add level</button>
              <button type="button" onClick={savePolicy} className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white">Save policy</button>
            </div>
          </section>

          <section aria-labelledby="modification-heading" className="border-t-2 border-slate-600 pt-4">
            <h2 id="modification-heading" className="text-lg font-semibold text-white">Request a modification</h2>
            <p className="mb-4 mt-1 text-xs text-slate-400">Routes a proposed invoice change for review and records the decision history.</p>
            <label htmlFor="change-invoice-id" className="mb-1 block text-xs text-slate-300">Invoice ID</label>
            <input id="change-invoice-id" value={changeInvoiceId} onChange={(event) => setChangeInvoiceId(event.target.value)} className="mb-3 w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <label htmlFor="change-amount" className="mb-1 block text-xs text-slate-300">Invoice amount for routing</label>
            <input id="change-amount" type="number" min="0" step="any" value={changeAmount} onChange={(event) => setChangeAmount(event.target.value)} className="mb-3 w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <label htmlFor="change-summary" className="mb-1 block text-xs text-slate-300">Requested change</label>
            <textarea id="change-summary" value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} rows={3} className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button type="button" onClick={submitModification} className="mt-3 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">Submit for approval</button>
          </section>
        </aside>
      </div>
    </main>
  );
}