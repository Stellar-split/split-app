import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchPayQueue from "@/components/BatchPayQueue";
import type { Invoice } from "@stellar-split/sdk";

vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (value: bigint) => (Number(value) / 10_000_000).toFixed(2),
  parseAmount: (value: string) => {
    const num = Number(value);
    return isNaN(num) ? 0n : BigInt(Math.round(num * 10_000_000));
  },
}));

const SCALE = 10_000_000n;

const createMockInvoice = (id: string, status: string = "Pending"): Invoice => ({
  id,
  creator: "GCREATOR",
  recipients: [
    { address: "GRECIPIENT1", amount: 50n * SCALE },
    { address: "GRECIPIENT2", amount: 50n * SCALE },
  ],
  token: "CUSDC",
  deadline: 0,
  funded: 0n,
  status,
  payments: [],
});

describe("Issue #597: BatchPayQueue error messages", () => {
  it("should render queue items with empty state message when queue is empty", () => {
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={[]}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    expect(
      screen.getByText(/search for invoices above to add them/i)
    ).toBeInTheDocument();
  });

  it("should display queue items with invoice details", () => {
    const invoice = createMockInvoice("inv-123");
    const queue = [{ invoice, amount: "100" }];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    const invoiceText = screen.getAllByText(/invoice #inv-123/i)[0];
    expect(invoiceText).toBeInTheDocument();
    expect(screen.getByText(/status: pending/i)).toBeInTheDocument();
  });

  it("should allow changing amount for queue items", async () => {
    const invoice = createMockInvoice("inv-456");
    const queue = [{ invoice, amount: "" }];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    const amountInput = screen.getByPlaceholderText(/amount \(usdc\)/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "75" } });

    expect(onAmountChange).toHaveBeenCalledWith("inv-456", "75");
  });

  it("should allow removing queue items", async () => {
    const invoice = createMockInvoice("inv-789");
    const queue = [{ invoice, amount: "100" }];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    const removeButton = screen.getByLabelText(/remove invoice/i);
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledWith("inv-789");
  });

  it("should calculate and display running total", () => {
    const invoice1 = createMockInvoice("inv-1");
    const invoice2 = createMockInvoice("inv-2");
    const queue = [
      { invoice: invoice1, amount: "50" },
      { invoice: invoice2, amount: "75" },
    ];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText(/running total/i)).toBeInTheDocument();
    expect(screen.getByText(/125 usdc/i)).toBeInTheDocument();
  });

  it("should handle drag and drop reordering", async () => {
    const invoice1 = createMockInvoice("inv-1");
    const invoice2 = createMockInvoice("inv-2");
    const queue = [
      { invoice: invoice1, amount: "50" },
      { invoice: invoice2, amount: "75" },
    ];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();
    const onReorder = vi.fn();

    const { container } = render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    );

    const firstItem = container.querySelector('[draggable="true"]');
    if (firstItem) {
      fireEvent.dragStart(firstItem);
      const items = container.querySelectorAll('[draggable="true"]');
      if (items.length > 1) {
        fireEvent.dragOver(items[1]);
        fireEvent.drop(items[1]);
      }
    }

    await waitFor(() => {
      expect(onReorder).toHaveBeenCalled();
    });
  });

  it("should support keyboard reordering with Alt+ArrowUp", async () => {
    const invoice1 = createMockInvoice("inv-1");
    const invoice2 = createMockInvoice("inv-2");
    const queue = [
      { invoice: invoice1, amount: "50" },
      { invoice: invoice2, amount: "75" },
    ];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();
    const onReorder = vi.fn();

    const { container } = render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    );

    const items = container.querySelectorAll('[draggable="true"]');
    if (items.length > 1) {
      fireEvent.keyDown(items[1], { key: "ArrowUp", altKey: true });
      expect(onReorder).toHaveBeenCalled();
    }
  });

  it("should support keyboard reordering with Alt+ArrowDown", async () => {
    const invoice1 = createMockInvoice("inv-1");
    const invoice2 = createMockInvoice("inv-2");
    const queue = [
      { invoice: invoice1, amount: "50" },
      { invoice: invoice2, amount: "75" },
    ];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();
    const onReorder = vi.fn();

    const { container } = render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    );

    const items = container.querySelectorAll('[draggable="true"]');
    if (items.length > 1) {
      fireEvent.keyDown(items[0], { key: "ArrowDown", altKey: true });
      expect(onReorder).toHaveBeenCalled();
    }
  });

  it("should handle NaN amounts in running total calculation", () => {
    const invoice1 = createMockInvoice("inv-1");
    const invoice2 = createMockInvoice("inv-2");
    const queue = [
      { invoice: invoice1, amount: "50" },
      { invoice: invoice2, amount: "" },
    ];
    const onAmountChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <BatchPayQueue
        queue={queue}
        onAmountChange={onAmountChange}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText(/50 usdc/i)).toBeInTheDocument();
  });
});
