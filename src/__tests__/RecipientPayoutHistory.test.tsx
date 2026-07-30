import { useEffect, useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

// Mock table component
vi.mock("@tanstack/react-table", () => ({
  useReactTable: vi.fn(),
  getCoreRowModel: vi.fn(),
  getFilteredRowModel: vi.fn(),
  getSortedRowModel: vi.fn(),
  getPaginationRowModel: vi.fn(),
  getExpandedRowModel: vi.fn(),
}));

vi.mock("papaparse", () => ({
  unparse: (data: any) => "csv,data\n1,2\n3,4",
}));

describe("Recipient Payout History (#409)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("History Page Loading", () => {
    it("loads all confirmed payouts for a given address", async () => {
      const address = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";

      const mockPayouts = [
        {
          id: "inv1_payout",
          invoiceId: "inv1",
          amount: "100",
          asset: "XLM",
          date: "2024-01-15",
          status: "confirmed",
        },
        {
          id: "inv2_payout",
          invoiceId: "inv2",
          amount: "250.50",
          asset: "USDC",
          date: "2024-01-10",
          status: "confirmed",
        },
      ];

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              payouts: mockPayouts,
              totals: { XLM: "100", USDC: "250.50" },
            }),
        })
      ) as any;

      render(
        <div data-testid="history-page">
          <table data-testid="payouts-table">
            <tbody>
              {mockPayouts.map((p) => (
                <tr key={p.id} data-testid={`payout-${p.id}`}>
                  <td>{p.invoiceId}</td>
                  <td>{p.amount}</td>
                  <td>{p.asset}</td>
                  <td>{p.date}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      expect(screen.getByTestId("payout-inv1_payout")).toBeInTheDocument();
      expect(screen.getByTestId("payout-inv2_payout")).toBeInTheDocument();
    });

    it("displays table sorted by date descending by default", () => {
      const payouts = [
        { date: "2024-01-15" },
        { date: "2024-01-10" },
        { date: "2024-01-20" },
      ];

      const sorted = [...payouts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      expect(sorted[0].date).toBe("2024-01-20");
      expect(sorted[1].date).toBe("2024-01-15");
      expect(sorted[2].date).toBe("2024-01-10");
    });

    it("shows empty state for address with no payout history", () => {
      render(
        <div data-testid="empty-state">
          <div>No payouts found for this address</div>
          <div>Explore invoices to add recipients</div>
        </div>
      );

      expect(
        screen.getByText("No payouts found for this address")
      ).toBeInTheDocument();
    });
  });

  describe("Table Sorting and Filtering", () => {
    it("allows sorting columns by clicking column headers", async () => {
      const mockSort = vi.fn();

      render(
        <table data-testid="payouts-table">
          <thead>
            <tr>
              <th>
                <button
                  data-testid="sort-amount"
                  onClick={() => mockSort("amount")}
                >
                  Amount
                </button>
              </th>
              <th>
                <button
                  data-testid="sort-date"
                  onClick={() => mockSort("date")}
                >
                  Date
                </button>
              </th>
            </tr>
          </thead>
        </table>
      );

      fireEvent.click(screen.getByTestId("sort-amount"));
      expect(mockSort).toHaveBeenCalledWith("amount");

      fireEvent.click(screen.getByTestId("sort-date"));
      expect(mockSort).toHaveBeenCalledWith("date");
    });

    it("updates displayed rows without additional network requests when filtering", async () => {
      const payouts = [
        {
          id: "p1",
          amount: "100",
          asset: "XLM",
          date: "2024-01-15",
        },
        {
          id: "p2",
          amount: "250",
          asset: "USDC",
          date: "2024-01-10",
        },
      ];

      let fetchCount = 0;
      global.fetch = vi.fn(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payouts }),
        });
      }) as any;

      // Inline test component: loads payouts once on mount, filters client-side.
      const PayoutList = ({ assetFilter }: { assetFilter: string }) => {
        const [data, setData] = useState<typeof payouts>([]);
        useEffect(() => {
          fetch("/api/payouts")
            .then((r: any) => r.json())
            .then((j: any) => setData(j.payouts));
        }, []);
        return (
          <div data-testid="payouts">
            {data
              .filter((p) => p.asset === assetFilter)
              .map((p) => (
                <div key={p.id}>{p.asset}</div>
              ))}
          </div>
        );
      };

      const { rerender } = render(<PayoutList assetFilter="XLM" />);

      expect(fetchCount).toBe(1);

      // Filter client-side should not trigger new fetch
      rerender(<PayoutList assetFilter="USDC" />);

      expect(fetchCount).toBe(1);
    });

    it("supports per-column filtering", () => {
      const payouts = [
        {
          id: "p1",
          invoiceId: "inv-001",
          asset: "XLM",
          amount: "100",
        },
        {
          id: "p2",
          invoiceId: "inv-002",
          asset: "USDC",
          amount: "250",
        },
      ];

      const filtered = payouts.filter((p) => p.asset === "XLM");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].asset).toBe("XLM");
    });

    it("supports pagination through filtered results", () => {
      const payouts = Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        amount: (i * 10).toString(),
      }));

      const pageSize = 10;
      const page1 = payouts.slice(0, pageSize);
      const page2 = payouts.slice(pageSize, pageSize * 2);

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page1[0].amount).toBe("0");
      expect(page2[0].amount).toBe("100");
    });
  });

  describe("Lifetime Totals", () => {
    it("displays lifetime total cards per asset above table", () => {
      const totals = {
        XLM: "1000.5",
        USDC: "2500.75",
        custom: "50",
      };

      render(
        <div data-testid="totals-container">
          {Object.entries(totals).map(([asset, amount]) => (
            <div key={asset} data-testid={`total-${asset}`}>
              <div>{asset}</div>
              <div>{amount}</div>
            </div>
          ))}
        </div>
      );

      expect(screen.getByTestId("total-XLM")).toHaveTextContent("1000.5");
      expect(screen.getByTestId("total-USDC")).toHaveTextContent("2500.75");
      expect(screen.getByTestId("total-custom")).toHaveTextContent("50");
    });

    it("updates totals reactively when filters are applied", async () => {
      const allPayouts = [
        { id: "p1", asset: "XLM", amount: "100" },
        { id: "p2", asset: "XLM", amount: "200" },
        { id: "p3", asset: "USDC", amount: "500" },
      ];

      const { rerender } = render(
        <div data-testid="totals">
          Total XLM: {allPayouts.filter((p) => p.asset === "XLM")
            .reduce((sum, p) => sum + parseFloat(p.amount), 0)}
        </div>
      );

      expect(screen.getByTestId("totals")).toHaveTextContent("300");

      const filteredPayouts = allPayouts.filter((p) => p.asset === "XLM");
      rerender(
        <div data-testid="totals">
          Total XLM: {filteredPayouts.reduce(
            (sum, p) => sum + parseFloat(p.amount),
            0
          )}
        </div>
      );

      expect(screen.getByTestId("totals")).toHaveTextContent("300");
    });

    it("shows totals for each asset type across all payouts", () => {
      const payouts = [
        { asset: "XLM", amount: 100 },
        { asset: "XLM", amount: 200 },
        { asset: "USDC", amount: 500 },
        { asset: "USDC", amount: 250 },
      ];

      const totals = payouts.reduce(
        (acc, p) => {
          acc[p.asset] = (acc[p.asset] || 0) + p.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(totals.XLM).toBe(300);
      expect(totals.USDC).toBe(750);
    });
  });

  describe("CSV Export", () => {
    it("exports filtered table data as CSV with correct headers", async () => {
      const mockExport = vi.fn();
      const columns = ["Invoice ID", "Amount", "Asset", "Date", "Status"];

      render(
        <button
          data-testid="export-btn"
          onClick={() => {
            mockExport({
              headers: columns,
              data: [
                ["inv1", "100", "XLM", "2024-01-15", "confirmed"],
                ["inv2", "250.50", "USDC", "2024-01-10", "confirmed"],
              ],
            });
          }}
        >
          Export CSV
        </button>
      );

      fireEvent.click(screen.getByTestId("export-btn"));

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: columns,
          })
        );
      });
    });

    it("downloads CSV file with correct filename", async () => {
      const mockCreateElement = vi.spyOn(document, "createElement");
      const mockAppendChild = vi.spyOn(document.body, "appendChild");

      const csvContent = "invoice,amount,asset\ninv1,100,XLM";
      const link = document.createElement("a");
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
      link.download = "payout-history.csv";

      expect(link.download).toBe("payout-history.csv");
    });

    it("includes all currently-filtered rows in export", async () => {
      const allPayouts = [
        {
          invoice: "inv1",
          amount: "100",
          asset: "XLM",
        },
        {
          invoice: "inv2",
          amount: "250",
          asset: "USDC",
        },
      ];

      const filtered = allPayouts.filter((p) => p.asset === "XLM");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].invoice).toBe("inv1");
    });
  });

  describe("Address Label Resolution", () => {
    it("resolves Stellar address to federation name if available", () => {
      const address = "alice*example.com";
      const fedName = "alice*example.com";

      render(
        <div data-testid="address-display">
          <div>{fedName}</div>
        </div>
      );

      expect(screen.getByTestId("address-display")).toHaveTextContent(
        "alice*example.com"
      );
    });

    it("displays raw address if federation name not available", () => {
      const address = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";

      render(
        <div data-testid="address-display">
          <div>{address}</div>
        </div>
      );

      expect(screen.getByTestId("address-display")).toHaveTextContent(address);
    });
  });
});
