import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ApiLogsPage from "@/app/settings/api-logs/page";
import { downloadCSV } from "@/lib/csvExport";

// Mock the csvExport module
jest.mock("@/lib/csvExport", () => ({
  downloadCSV: jest.fn(),
}));

const mockKeys = [
  { id: "key-1", name: "Gateway Alpha", key: "sk_abc", createdAt: Date.now() },
  { id: "key-2", name: "Client Beta", key: "sk_xyz", createdAt: Date.now() },
];

const mockLogs = [
  {
    id: "log-1",
    timestamp: new Date("2026-06-20T10:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-2",
    timestamp: new Date("2026-06-21T11:00:00Z").getTime(),
    endpoint: "/api/pay",
    keyId: "key-1",
    statusCode: 500,
  },
  {
    id: "log-3",
    timestamp: new Date("2026-06-22T12:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-2",
    statusCode: 200,
  },
  {
    id: "log-4",
    timestamp: new Date("2026-06-23T13:00:00Z").getTime(),
    endpoint: "/api/test-webhook",
    keyId: "key-2",
    statusCode: 400,
  },
  {
    id: "log-5",
    timestamp: new Date("2026-06-24T14:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-6",
    timestamp: new Date("2026-06-25T15:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-7",
    timestamp: new Date("2026-06-26T16:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-8",
    timestamp: new Date("2026-06-26T17:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-9",
    timestamp: new Date("2026-06-26T18:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-10",
    timestamp: new Date("2026-06-26T19:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
  {
    id: "log-11",
    timestamp: new Date("2026-06-26T20:00:00Z").getTime(),
    endpoint: "/api/invoices",
    keyId: "key-1",
    statusCode: 200,
  },
];

describe("ApiLogsPage - Request Log Viewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("apiKeys", JSON.stringify(mockKeys));
    localStorage.setItem("apiLogs", JSON.stringify(mockLogs));
  });

  test("renders the page and displays seeded logs", () => {
    render(<ApiLogsPage />);

    // Check that header is rendered
    expect(screen.getByText("API Logs")).toBeInTheDocument();

    // Total logs is 11, items per page is 10.
    // So on page 1 we show logs 11 to 2 in descending timestamp order (10 logs)
    expect(screen.getByText("Showing 1–10 of 11 request logs")).toBeInTheDocument();

    // Check key select box has correct options
    const keySelect = screen.getByLabelText("Filter by API Key");
    expect(within(keySelect).getByText("All Keys")).toBeInTheDocument();
    expect(within(keySelect).getByText("Gateway Alpha")).toBeInTheDocument();
    expect(within(keySelect).getByText("Client Beta")).toBeInTheDocument();
  });

  test("paginates logs correctly", () => {
    render(<ApiLogsPage />);

    // Page 1 should be active initially
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    // Click Next
    const nextButton = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextButton);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Showing 11–11 of 11 request logs")).toBeInTheDocument();

    // Click Previous
    const prevButton = screen.getByRole("button", { name: "Previous" });
    fireEvent.click(prevButton);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  test("filters logs by key, endpoint, and date range simultaneously", () => {
    render(<ApiLogsPage />);

    const keySelect = screen.getByLabelText("Filter by API Key");
    const endpointSelect = screen.getByLabelText("Filter by Endpoint");
    const startDateInput = screen.getByLabelText("Start Date");
    const endDateInput = screen.getByLabelText("End Date");

    // Filter simultaneously
    fireEvent.change(keySelect, { target: { value: "key-1" } });
    fireEvent.change(endpointSelect, { target: { value: "/api/invoices" } });
    fireEvent.change(startDateInput, { target: { value: "2026-06-21" } });
    fireEvent.change(endDateInput, { target: { value: "2026-06-25" } });

    // Expected matches (Gateway Alpha & /api/invoices & between 21st and 25th inclusive):
    // log-5 (24th), log-6 (25th).
    // log-1 is 20th (excluded by startDate), log-2 is /api/pay (excluded by endpoint),
    // log-7, 8, 9, 10, 11 are 26th (excluded by endDate).
    expect(screen.getByText("Showing 1–2 of 2 request logs")).toBeInTheDocument();
  });

  test("CSV export respects the currently applied filters", () => {
    render(<ApiLogsPage />);

    const keySelect = screen.getByLabelText("Filter by API Key");
    const endpointSelect = screen.getByLabelText("Filter by Endpoint");

    // Filter by Client Beta (key-2) & /api/invoices
    fireEvent.change(keySelect, { target: { value: "key-2" } });
    fireEvent.change(endpointSelect, { target: { value: "/api/invoices" } });

    // Only log-3 matches
    expect(screen.getByText("Showing 1–1 of 1 request logs")).toBeInTheDocument();

    // Click Export CSV
    const exportButton = screen.getByRole("button", { name: "Export CSV" });
    fireEvent.click(exportButton);

    // downloadCSV should be called with CSV string containing only log-3
    expect(downloadCSV).toHaveBeenCalledTimes(1);

    const csvArg = (downloadCSV as jest.Mock).mock.calls[0][0];
    const filenameArg = (downloadCSV as jest.Mock).mock.calls[0][1];

    expect(filenameArg).toMatch(/^api-request-logs-\d{4}-\d{2}-\d{2}\.csv$/);

    // Verify CSV Content
    const lines = csvArg.split("\n");
    expect(lines[0]).toBe("Timestamp,Endpoint,API Key,Status Code");

    // There should be exactly 2 lines (headers + 1 data row)
    expect(lines.length).toBe(2);

    const fields = lines[1].split(",");
    expect(fields[0]).toBe(new Date("2026-06-22T12:00:00Z").toISOString());
    expect(fields[1]).toBe("/api/invoices");
    expect(fields[2]).toBe("Client Beta");
    expect(fields[3]).toBe("200");
  });
});
