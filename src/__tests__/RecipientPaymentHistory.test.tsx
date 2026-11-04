import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RecipientPaymentHistory from "@/components/invoice/RecipientPaymentHistory";

// ── Stable mocks ──────────────────────────────────────────────────────────

const INVOICE_ID = "inv-001";
const RECIPIENT_ID = "GABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234";

const ENTRY_1 = {
  operationHash: "aabbccdd1122",
  amount: "100.00",
  asset: "XLM",
  timestamp: new Date("2026-01-15T10:00:00Z").toISOString(),
  from: "GESCROW123456789012345678901234567890123456789012345678",
};

const ENTRY_2 = {
  operationHash: "eeff33445566",
  amount: "50.00",
  asset: "USDC",
  timestamp: new Date("2026-01-20T12:00:00Z").toISOString(),
  from: "GESCROW123456789012345678901234567890123456789012345678",
};

function mockFetch(
  entries: typeof ENTRY_1[],
  cursor: string | null = null,
  ok = true
) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    json: () =>
      Promise.resolve(
        ok
          ? { entries, cursor, recipientId: RECIPIENT_ID, invoiceId: INVOICE_ID }
          : { error: "Server error" }
      ),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch([]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("RecipientPaymentHistory", () => {
  it("shows loading state while fetching", () => {
    // Never resolves — keeps the component in loading state
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {}))
    );

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    expect(screen.getByText(/loading payment history/i)).toBeTruthy() // element exists in DOM;
  });

  it("shows empty state when no payments exist", async () => {
    vi.stubGlobal("fetch", mockFetch([]));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("empty-history")
      ).toBeTruthy() // element exists in DOM;
    });

    expect(
      screen.getByText(/no payments recorded yet/i)
    ).toBeTruthy() // element exists in DOM;
  });

  it("renders a payment entry with amount and asset", async () => {
    vi.stubGlobal("fetch", mockFetch([ENTRY_1]));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`history-entry-${ENTRY_1.operationHash}`)
      ).toBeTruthy() // element exists in DOM;
    });

    expect(screen.getByText(/100\.00/)).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/XLM/)).toBeTruthy() // element exists in DOM;
  });

  it("renders multiple entries", async () => {
    vi.stubGlobal("fetch", mockFetch([ENTRY_1, ENTRY_2]));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`history-entry-${ENTRY_1.operationHash}`)
      ).toBeTruthy() // element exists in DOM;
    });

    expect(
      screen.getByTestId(`history-entry-${ENTRY_2.operationHash}`)
    ).toBeTruthy() // element exists in DOM;
  });

  it("shows 'Load more' button when cursor is present", async () => {
    vi.stubGlobal("fetch", mockFetch([ENTRY_1], "20"));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load more/i })
      ).toBeTruthy() // element exists in DOM;
    });
  });

  it("does not show 'Load more' when cursor is null", async () => {
    vi.stubGlobal("fetch", mockFetch([ENTRY_1], null));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`history-entry-${ENTRY_1.operationHash}`)
      ).toBeTruthy() // element exists in DOM;
    });

    expect(
      screen.queryByRole("button", { name: /load more/i })
    ).not.toBeTruthy() // element exists in DOM;
  });

  it("loads more entries when 'Load more' is clicked", async () => {
    const user = userEvent.setup();

    // First call returns ENTRY_1 with a cursor, second call returns ENTRY_2
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [ENTRY_1],
              cursor: "20",
              recipientId: RECIPIENT_ID,
              invoiceId: INVOICE_ID,
            }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: [ENTRY_2],
              cursor: null,
              recipientId: RECIPIENT_ID,
              invoiceId: INVOICE_ID,
            }),
        } as Response)
    );

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load more/i })
      ).toBeTruthy() // element exists in DOM;
    });

    await user.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId(`history-entry-${ENTRY_2.operationHash}`)
      ).toBeTruthy() // element exists in DOM;
    });

    // Original entry still visible
    expect(
      screen.getByTestId(`history-entry-${ENTRY_1.operationHash}`)
    ).toBeTruthy() // element exists in DOM;

    // Cursor exhausted — Load more button gone
    expect(
      screen.queryByRole("button", { name: /load more/i })
    ).not.toBeTruthy() // element exists in DOM;
  });

  it("shows an error message when the fetch fails", async () => {
    vi.stubGlobal("fetch", mockFetch([], null, false));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy() // element exists in DOM;
    });
  });

  it("fetches with correct URL including invoiceId and recipientId", async () => {
    const fetchSpy = mockFetch([ENTRY_1]);
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/invoices/${INVOICE_ID}/recipients/${RECIPIENT_ID}/history`
        ),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("each entry shows a truncated transaction hash", async () => {
    vi.stubGlobal("fetch", mockFetch([ENTRY_1]));

    render(
      <RecipientPaymentHistory
        invoiceId={INVOICE_ID}
        recipientId={RECIPIENT_ID}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`history-entry-${ENTRY_1.operationHash}`)
      ).toBeTruthy() // element exists in DOM;
    });

    // TxHash component shows first 8 chars...last 6 chars
    const truncated = `${ENTRY_1.operationHash.slice(0, 8)}...${ENTRY_1.operationHash.slice(-6)}`;
    expect(screen.getByText(truncated)).toBeTruthy() // element exists in DOM;
  });
});
