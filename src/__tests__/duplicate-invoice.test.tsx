/**
 * Tests for the duplicate-invoice clone flow.
 *
 * 1. Unit tests for `validateDeadline` (pure logic, no DOM needed).
 * 2. Integration tests for the URL pre-fill parsing in NewInvoiceForm:
 *    - `from` query param triggers loading state
 *    - `deadline` query param is applied to the datetime-local input
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { validateDeadline } from "@/components/DuplicateModal";

// ── Unit tests: validateDeadline ──────────────────────────────────────────────

describe("validateDeadline", () => {
  test("returns null for a deadline 1 hour from now", () => {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000 + 1000).toISOString();
    expect(validateDeadline(oneHourFromNow)).toBeNull();
  });

  test("returns error for a deadline exactly now", () => {
    const now = new Date().toISOString();
    expect(validateDeadline(now)).toBe(
      "Deadline must be at least 1 hour in the future"
    );
  });

  test("returns error for a deadline 59 minutes from now", () => {
    const almostOneHour = new Date(Date.now() + 59 * 60 * 1000).toISOString();
    expect(validateDeadline(almostOneHour)).toBe(
      "Deadline must be at least 1 hour in the future"
    );
  });

  test("returns error for a deadline in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(validateDeadline(past)).toBe(
      "Deadline must be at least 1 hour in the future"
    );
  });

  test("returns error for an invalid date string", () => {
    expect(validateDeadline("not-a-date")).toBe("Please enter a valid date.");
  });

  test("accepts a deadline 7 days from now", () => {
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(validateDeadline(sevenDays)).toBeNull();
  });
});

// ── Integration tests: URL pre-fill ──────────────────────────────────────────

// Stub next/navigation so the component under test can render in Jest/jsdom.
const mockSearchParams = new Map<string, string>();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Stub heavy SDK so tests don't hit the network.
jest.mock("@/lib/stellar", () => ({
  splitClient: {
    getInvoice: jest.fn().mockResolvedValue({
      id: "42",
      creator: "GABC",
      recipients: [{ address: "GXYZ", amount: 10_000_000n }],
      token: "CUSDC",
      deadline: Math.floor(Date.now() / 1000) + 86400,
      funded: 0n,
      status: "Pending",
      payments: [],
    }),
    createInvoice: jest.fn(),
  },
}));

jest.mock("@/lib/freighter", () => ({
  getFreighterPublicKey: jest.fn().mockResolvedValue("GPUBKEY"),
}));

// Minimal stubs for child components that are not under test.
jest.mock("@/components/RecipientForm", () => ({
  __esModule: true,
  default: () => <div data-testid="recipient-form" />,
}));
jest.mock("@/components/TemplateManager", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/TxConfirmModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/components/DeadlineSuggester", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/invoiceHistory", () => ({
  recordInvoiceHistory: jest.fn(),
}));

// Import the page AFTER all mocks are set up.
// eslint-disable-next-line import/first
import NewInvoicePage from "@/app/invoice/new/page";

describe("NewInvoicePage — URL pre-fill (clone mode)", () => {
  beforeEach(() => {
    mockSearchParams.clear();
  });

  test("shows 'Loading invoice data…' when from param is present", async () => {
    mockSearchParams.set("from", "42");

    render(<NewInvoicePage />);

    // Loading message should appear while getInvoice is in-flight
    expect(screen.getByText(/Loading invoice data/i)).toBeInTheDocument();
  });

  test("shows cloned-from banner with link to source invoice after load", async () => {
    mockSearchParams.set("from", "42");
    mockSearchParams.set("deadline", new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());

    render(<NewInvoicePage />);

    await waitFor(() =>
      expect(screen.getByText(/#42/)).toBeInTheDocument()
    );

    const link = screen.getByRole("link", { name: /#42/ });
    expect(link).toHaveAttribute("href", "/invoice/42");
  });

  test("applies deadline param to the datetime-local input", async () => {
    const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const deadlineIso = deadline.toISOString().slice(0, 16);
    mockSearchParams.set("from", "42");
    mockSearchParams.set("deadline", deadlineIso);

    render(<NewInvoicePage />);

    await waitFor(() => {
      const input = screen.getByLabelText(/deadline/i) as HTMLInputElement;
      expect(input.value).toBe(deadlineIso);
    });
  });

  test("shows no cloned-from banner when from param is absent", () => {
    render(<NewInvoicePage />);
    expect(screen.queryByText(/Cloned from/i)).not.toBeInTheDocument();
  });
});
