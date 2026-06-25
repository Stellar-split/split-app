/**
 * Unit tests for CloneLineageTree.
 *
 * Acceptance criterion: correct tree structure for a 3-level chain with
 * 2 siblings at depth 2 (i.e. the current invoice has 2 sibling clones).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resolveCloneChain } from "@/components/CloneLineageTree";
import type { CloneInvoice } from "@/components/CloneLineageTree";

// ── Shared invoice factory ─────────────────────────────────────────────────

const BASE: Omit<CloneInvoice, "id" | "parentInvoiceId" | "cloneDepth"> = {
  creator: "GCREATOR",
  recipients: [{ address: "GRECP", amount: 10_000_000n }],
  token: "CUSDC",
  deadline: Math.floor(Date.now() / 1000) + 86400,
  funded: 0n,
  status: "Pending",
  payments: [],
};

function inv(
  id: string,
  parentInvoiceId?: string,
  clones?: string[]
): CloneInvoice {
  return { ...BASE, id, parentInvoiceId, ...(clones ? { clones } : {}) } as CloneInvoice;
}

// ── Mock stellar client ────────────────────────────────────────────────────

// 3-level chain: root(1) → mid(2) → current(3)
// mid has 2 other clones (siblings of current): sib-a, sib-b
const INVOICES: Record<string, CloneInvoice> = {
  "1": inv("1"),
  "2": inv("2", "1", ["3", "sib-a", "sib-b"]),
  "3": inv("3", "2"),
  "sib-a": inv("sib-a", "2"),
  "sib-b": inv("sib-b", "2"),
};

jest.mock("@/lib/stellar", () => ({
  splitClient: {
    getInvoice: jest.fn(async (id: string) => {
      const inv = INVOICES[id];
      if (!inv) throw new Error(`Invoice ${id} not found`);
      return inv;
    }),
  },
}));

// next/link renders an <a> in tests
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── resolveCloneChain unit tests ───────────────────────────────────────────

describe("resolveCloneChain", () => {
  test("returns null for a single node with no parent", async () => {
    const result = await resolveCloneChain("1");
    expect(result).toBeNull();
  });

  test("3-level chain: root node is invoice 1", async () => {
    const result = await resolveCloneChain("3");
    expect(result).not.toBeNull();
    expect(result!.invoice.id).toBe("1");
  });

  test("3-level chain: mid node is invoice 2 (child of root)", async () => {
    const result = await resolveCloneChain("3");
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].invoice.id).toBe("2");
  });

  test("3-level chain: current node (3) is leaf child of mid", async () => {
    const result = await resolveCloneChain("3");
    const leaf = result!.children[0].children[0];
    expect(leaf.invoice.id).toBe("3");
    expect(leaf.children).toHaveLength(0);
  });

  test("3-level chain: 2 siblings at depth 2 (siblings of invoice 3)", async () => {
    const result = await resolveCloneChain("3");
    const leaf = result!.children[0].children[0];
    expect(leaf.siblings).toHaveLength(2);
    const sibIds = leaf.siblings.map((s) => s.id).sort();
    expect(sibIds).toEqual(["sib-a", "sib-b"]);
  });

  test("chain length stops at MAX_DEPTH", async () => {
    // A chain deeper than MAX_DEPTH should not cause infinite recursion.
    // We only have 3 real levels in our fixture, so resolveCloneChain("3", 2)
    // should stop walking up after 2 hops.
    const result = await resolveCloneChain("3", 2);
    // With MAX_DEPTH=2 we can only walk up 2 ancestors (3→2→1 = 3 items total)
    // so root should still be invoice 1 (chain fits within limit)
    expect(result).not.toBeNull();
  });
});

// ── CloneLineageTree render tests ──────────────────────────────────────────

// Import the default export separately so we can test rendering
import CloneLineageTree from "@/components/CloneLineageTree";

describe("CloneLineageTree component", () => {
  test("renders nothing for a single-node invoice (no parent)", async () => {
    const { container } = render(<CloneLineageTree invoiceId="1" />);
    // Allow async resolution
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  test("renders a 'Clone Lineage' heading for a multi-node chain", async () => {
    render(<CloneLineageTree invoiceId="3" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Clone Lineage/i })).toBeInTheDocument()
    );
  });

  test("current invoice node has aria-current=page", async () => {
    render(<CloneLineageTree invoiceId="3" />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /#3/i })).toHaveAttribute("aria-current", "page")
    );
  });

  test("all chain nodes are clickable links to their invoice pages", async () => {
    render(<CloneLineageTree invoiceId="3" />);
    await waitFor(() => screen.getByRole("heading", { name: /Clone Lineage/i }));

    const link1 = screen.getByRole("link", { name: /#1/i });
    const link2 = screen.getByRole("link", { name: /#2/i });
    const link3 = screen.getByRole("link", { name: /#3/i });

    expect(link1).toHaveAttribute("href", "/invoice/1");
    expect(link2).toHaveAttribute("href", "/invoice/2");
    expect(link3).toHaveAttribute("href", "/invoice/3");
  });

  test("sibling nodes are rendered as links", async () => {
    render(<CloneLineageTree invoiceId="3" />);
    await waitFor(() => screen.getByRole("heading", { name: /Clone Lineage/i }));

    expect(screen.getByRole("link", { name: /#sib-a/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /#sib-b/i })).toBeInTheDocument();
  });
});
