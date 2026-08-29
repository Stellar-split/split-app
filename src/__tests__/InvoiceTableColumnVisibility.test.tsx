import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoiceTable from "@/components/InvoiceTable";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    creator: "GCREATOR1",
    recipients: [{ address: "GRECIPIENT1", amount: 100_000_000n }],
    token: "CUSDC",
    deadline: 0,
    funded: 50_000_000n,
    status: "Pending",
    payments: [],
  },
  {
    id: "inv-2",
    creator: "GCREATOR2",
    recipients: [{ address: "GRECIPIENT2", amount: 200_000_000n }],
    token: "CUSDC",
    deadline: Math.floor(Date.now() / 1000) + 86400,
    funded: 100_000_000n,
    status: "Released",
    payments: [{ payer: "GPAYER1", amount: 100_000_000n }],
  },
];

describe("InvoiceTable Column Visibility Toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a gear icon button to open column settings", () => {
    render(<InvoiceTable invoices={mockInvoices} />);
    const gearButton = screen.getByRole("button", { name: /column settings/i });
    expect(gearButton).toBeInTheDocument();
  });

  it("displays dropdown menu with column toggles when gear icon is clicked", async () => {
    const user = userEvent.setup();
    render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    expect(screen.getByText(/ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Deadline/i)).toBeInTheDocument();
    expect(screen.getByText(/Funded/i)).toBeInTheDocument();
  });

  it("toggles column visibility when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    const tagsCheckbox = screen.getByRole("checkbox", { name: /Tags/i });
    await user.click(tagsCheckbox);

    const tagHeaders = screen.queryAllByText(/Tags/i);
    expect(tagHeaders.length).toBe(1);
  });

  it("persists column visibility preference to localStorage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    const recipientsCheckbox = screen.getByRole("checkbox", { name: /Recipients/i });
    await user.click(recipientsCheckbox);

    const savedPreferences = localStorage.getItem("invoiceTableColumns");
    expect(savedPreferences).toBeTruthy();
    expect(savedPreferences).toContain("recipients");

    unmount();
  });

  it("restores column visibility from localStorage on mount", async () => {
    localStorage.setItem(
      "invoiceTableColumns",
      JSON.stringify({ tags: false, recipients: false })
    );

    render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await userEvent.click(gearButton);

    const tagsCheckbox = screen.getByRole("checkbox", { name: /Tags/i });
    const recipientsCheckbox = screen.getByRole("checkbox", { name: /Recipients/i });

    expect(tagsCheckbox).not.toBeChecked();
    expect(recipientsCheckbox).not.toBeChecked();
  });

  it("keeps required columns visible when optional columns are hidden", async () => {
    const user = userEvent.setup();
    render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    const tagsCheckbox = screen.getByRole("checkbox", { name: /Tags/i });
    const recipientsCheckbox = screen.getByRole("checkbox", { name: /Recipients/i });

    await user.click(tagsCheckbox);
    await user.click(recipientsCheckbox);

    expect(screen.getByText("inv-1")).toBeInTheDocument();
    expect(screen.getByText("inv-2")).toBeInTheDocument();
    expect(screen.getByText("100.00")).toBeInTheDocument();
  });

  it("closes dropdown menu when clicking outside", async () => {
    const user = userEvent.setup();
    const { container } = render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    expect(screen.getByText(/ID/i)).toBeInTheDocument();

    fireEvent.click(container);

    await waitFor(() => {
      expect(screen.queryByText(/ID/i)).not.toBeInTheDocument();
    });
  });

  it("closes dropdown menu when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<InvoiceTable invoices={mockInvoices} />);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  it("hides columns without page reload after toggling", async () => {
    const user = userEvent.setup();
    render(<InvoiceTable invoices={mockInvoices} />);

    const amountBefore = screen.getAllByText(/100\.00/);
    expect(amountBefore.length).toBeGreaterThan(0);

    const gearButton = screen.getByRole("button", { name: /column settings/i });
    await user.click(gearButton);

    const amountCheckbox = screen.getByRole("checkbox", { name: /Amount/i });
    await user.click(amountCheckbox);

    const amountAfter = screen.queryAllByText(/100\.00/);
    expect(amountAfter.length).toBe(0);
  });

  it("renders all columns initially visible by default", () => {
    render(<InvoiceTable invoices={mockInvoices} />);

    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByText("Funded")).toBeInTheDocument();
  });
});
