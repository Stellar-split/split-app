/**
 * Unit tests for the group detail page at src/app/groups/[id]/page.tsx.
 *
 * Covers:
 *  - Loading state while group data is fetched from localStorage
 *  - "Group not found" state when id doesn't match any saved group
 *  - Group name, member count, and member addresses are displayed
 *  - Empty members state shows "No members" message
 *  - "Create Invoice for Group" button navigates to /invoice/new
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import GroupDetailPage from "@/app/groups/[id]/page";

// ─── Hoist mock function references ─────────────────────────────────────────
const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

// ─── Next navigation mock ───────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-group-1" }),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// ─── SDK mock ────────────────────────────────────────────────────────────────
vi.mock("@stellar-split/sdk", () => ({
  truncateAddress: (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr,
}));

// ─── next/link mock ─────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedGroup(group: { id: string; name: string; members: string[]; lastActive: number }) {
  localStorage.setItem("contactGroups", JSON.stringify([group]));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GroupDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockReset();
  });

  test("shows 'Group not found' when no matching group exists", async () => {
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(/Group not found/i)).toBeInTheDocument()
    );
  });

  test("renders group name and member count", async () => {
    seedGroup({
      id: "test-group-1",
      name: "Alpha Team",
      members: ["GPAYER1", "GPAYER2", "GPAYER3"],
      lastActive: Date.now(),
    });
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("Alpha Team")).toBeInTheDocument()
    );
    expect(screen.getByText(/3 members/i)).toBeInTheDocument();
  });

  test("shows all member addresses", async () => {
    seedGroup({
      id: "test-group-1",
      name: "Beta Group",
      members: ["GALICE1234567890", "GBOB12345678901"],
      lastActive: Date.now(),
    });
    render(<GroupDetailPage />);
    await waitFor(() => screen.getByText("Beta Group"));
    // Each address renders as both full and truncated (truncateAddress shortens it)
    expect(screen.getByText("GALICE1234567890")).toBeInTheDocument();
    expect(screen.getByText("GBOB12345678901")).toBeInTheDocument();
  });

  test("shows 'No members' when group has empty members list", async () => {
    seedGroup({
      id: "test-group-1",
      name: "Empty Group",
      members: [],
      lastActive: Date.now(),
    });
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(/No members in this group/i)).toBeInTheDocument()
    );
  });

  test("'Create Invoice for Group' button navigates to /invoice/new", async () => {
    seedGroup({
      id: "test-group-1",
      name: "Dev Team",
      members: ["GPAYER1"],
      lastActive: Date.now(),
    });
    render(<GroupDetailPage />);
    await waitFor(() => screen.getByText("Dev Team"));

    act(() => {
      screen.getByRole("button", { name: /Create Invoice for Group/i }).click();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoice/new");
  });

  test("singular member count for a group with 1 member", async () => {
    seedGroup({
      id: "test-group-1",
      name: "Solo Group",
      members: ["GONLY_ONE"],
      lastActive: Date.now(),
    });
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(/1 member$/i)).toBeInTheDocument()
    );
  });
});
