"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";

/** Invoice extended with clone-tracking fields not yet in the published SDK. */
export interface CloneInvoice extends Invoice {
  parentInvoiceId?: string;
  cloneDepth?: number;
}

/**
 * A node in the resolved lineage tree.
 * `siblings` are other invoices that share the same parentInvoiceId.
 */
export interface LineageNode {
  invoice: CloneInvoice;
  children: LineageNode[];
  siblings: CloneInvoice[];
}

/**
 * Walk up the parent chain to build the ordered list of ancestors
 * (root first, current last), then attach siblings at the current level.
 * Max depth capped at 5 to mirror contract limits.
 */
export async function resolveCloneChain(
  currentId: string,
  MAX_DEPTH = 5
): Promise<LineageNode | null> {
  const chain: CloneInvoice[] = [];

  let id: string | undefined = currentId;
  let depth = 0;

  // Walk up ancestor chain
  while (id && depth <= MAX_DEPTH) {
    const inv = (await splitClient.getInvoice(id)) as CloneInvoice;
    chain.unshift(inv); // prepend so root ends up first
    id = inv.parentInvoiceId;
    depth++;
  }

  if (chain.length <= 1 && !chain[0]?.parentInvoiceId) {
    // No lineage — single node with no parent
    return null;
  }

  // Fetch siblings: other invoices that share the current invoice's parent
  const current = chain[chain.length - 1];
  let siblings: CloneInvoice[] = [];
  if (current.parentInvoiceId) {
    try {
      const parent = chain[chain.length - 2] ?? (await splitClient.getInvoice(current.parentInvoiceId) as CloneInvoice);
      const rawSiblings = ((parent as any).clones as string[] | undefined) ?? [];
      const fetched = await Promise.all(
        rawSiblings
          .filter((sid) => sid !== currentId)
          .map((sid) => splitClient.getInvoice(sid) as Promise<CloneInvoice>)
      );
      siblings = fetched;
    } catch {
      // Silently ignore — sibling info is best-effort
    }
  }

  // Build nested node structure (linear chain with siblings branching at current level)
  function buildNode(index: number): LineageNode {
    const inv = chain[index];
    const isLast = index === chain.length - 1;
    return {
      invoice: inv,
      children: isLast ? [] : [buildNode(index + 1)],
      siblings: isLast ? siblings : [],
    };
  }

  return buildNode(0);
}

// ── Rendering helpers ──────────────────────────────────────────────────────

function NodeCard({
  invoice,
  isCurrent,
}: {
  invoice: CloneInvoice;
  isCurrent: boolean;
}) {
  return (
    <Link
      href={`/invoice/${invoice.id}`}
      className={`inline-flex flex-col px-3 py-2 rounded-lg border text-sm transition-colors min-w-[120px] text-center ${
        isCurrent
          ? "border-indigo-500 bg-indigo-950 text-indigo-200 font-semibold ring-2 ring-indigo-500"
          : "border-gray-700 bg-gray-900 text-gray-300 hover:border-indigo-400 hover:text-indigo-200"
      }`}
      aria-current={isCurrent ? "page" : undefined}
    >
      <span className="font-mono text-xs text-gray-400">#{invoice.id}</span>
      <span className="capitalize text-xs mt-0.5">{invoice.status}</span>
    </Link>
  );
}

function TreeNode({
  node,
  currentId,
}: {
  node: LineageNode;
  currentId: string;
}) {
  const isCurrent = node.invoice.id === currentId;
  const hasChildren = node.children.length > 0;
  const hasSiblings = node.siblings.length > 0;

  return (
    <div className="flex flex-col items-center gap-0">
      <NodeCard invoice={node.invoice} isCurrent={isCurrent} />

      {(hasChildren || hasSiblings) && (
        /* vertical connector */
        <div className="w-px h-4 bg-gray-700" aria-hidden />
      )}

      {hasSiblings && (
        /* horizontal row: main child + sibling branches */
        <div className="flex items-start gap-4">
          {node.children.map((child) => (
            <div key={child.invoice.id} className="flex flex-col items-center gap-0">
              <TreeNode node={child} currentId={currentId} />
            </div>
          ))}
          {node.siblings.map((sib) => (
            <div key={sib.id} className="flex flex-col items-center gap-0">
              <NodeCard invoice={sib} isCurrent={false} />
            </div>
          ))}
        </div>
      )}

      {!hasSiblings && hasChildren && (
        <div className="flex flex-col items-center">
          <TreeNode node={node.children[0]} currentId={currentId} />
        </div>
      )}
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────

interface Props {
  invoiceId: string;
}

export default function CloneLineageTree({ invoiceId }: Props) {
  const [root, setRoot] = useState<LineageNode | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    resolveCloneChain(invoiceId).then((result) => {
      if (!cancelled) setRoot(result);
    }).catch(() => {
      if (!cancelled) setRoot(null);
    });
    return () => { cancelled = true; };
  }, [invoiceId]);

  // Render nothing for single-node case (no clones) or on error
  if (root === "loading" || root === null) return null;

  return (
    <section aria-labelledby="lineage-heading" className="mb-8">
      <h2 id="lineage-heading" className="text-lg font-semibold mb-4">
        Clone Lineage
      </h2>
      {/* Horizontal scroll container for deep chains */}
      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 p-4">
        <div className="inline-flex min-w-full justify-center">
          <TreeNode node={root} currentId={invoiceId} />
        </div>
      </div>
    </section>
  );
}
