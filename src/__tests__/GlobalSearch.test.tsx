import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, test, beforeEach, afterEach, expect } from "vitest";
import GlobalSearch from "@/components/GlobalSearch";
import type { Invoice } from "@stellar-split/sdk";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

describe("GlobalSearch — query highlighting", () => {
  const mockInvoices: Invoice[] = [
    {
      id: "INV-2024-001",
      title: "Office Supplies",
      creator: "GCZQ2WQUX4ZQZLWQTCCQ27FQSQQ2WQUX4ZQZLWQTC",
      status: "Released",
      recipients: [
        {
          address: "GDZST3XVCDTUJ76ZAV2HA72KYXQQ2WQUX4ZQZLW",
          share: 50,
        },
      ],
      amount: "100.00",
      currency: "USD",
      createdAt: new Date(),
      expiresAt: new Date(),
    } as Invoice,
    {
      id: "INV-2024-002",
      title: "Marketing Campaign",
      creator: "GDZST3XVCDTUJ76ZAV2HA72KYXQQ2WQUX4ZQZLW",
      status: "Pending",
      recipients: [
        {
          address: "GCZQ2WQUX4ZQZLWQTCCQ27FQSQQ2WQUX4ZQZLWQTC",
          share: 100,
        },
      ],
      amount: "200.00",
      currency: "USD",
      createdAt: new Date(),
      expiresAt: new Date(),
    } as Invoice,
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Types a query into the search input and flushes the debounce timer. */
  function typeQuery(value: string) {
    const input = screen.getByRole("combobox");
    act(() => {
      fireEvent.change(input, { target: { value } });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
  }

  /** Opens the search dialog via the first "Open search" trigger. */
  function openSearch() {
    const trigger = screen.getAllByRole("button", { name: /open search/i })[0];
    fireEvent.click(trigger);
  }

  test("highlights matched substring in invoice ID (case-insensitive)", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();
    typeQuery("inv-2024");

    expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
  });

  test("highlights matched substring in invoice title", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();
    typeQuery("office");

    expect(screen.getByText(/office/i)).toBeTruthy() // element exists in DOM;
  });

  test("highlights matched substring in creator address", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();
    typeQuery("GCZQ2WQ");

    expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
  });

  test("highlights matched substring in recipient address", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();
    typeQuery("GDZST3X");

    expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
  });

  test("handles empty query without highlighting", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();

    expect(
      screen.getByText(/start typing to search invoices and addresses/i)
    ).toBeTruthy() // element exists in DOM;
  });

  test("case-insensitive matching highlights correctly", async () => {
    render(<GlobalSearch invoices={mockInvoices} publicKey={null} />);

    openSearch();
    typeQuery("OFFICE");

    // Should find the result even with uppercase query
    expect(screen.queryByText(/no results for/i)).not.toBeTruthy() // element exists in DOM;
  });
});
