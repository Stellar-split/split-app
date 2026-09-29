import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceEducationalResources from "@/components/InvoiceEducationalResources";
import { INVOICE_RESOURCES, filterResources } from "@/lib/invoiceResources";

describe("filterResources", () => {
  it("returns everything with no filter", () => {
    expect(filterResources(INVOICE_RESOURCES)).toHaveLength(INVOICE_RESOURCES.length);
  });

  it("filters by category", () => {
    const result = filterResources(INVOICE_RESOURCES, { category: "security" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.category === "security")).toBe(true);
  });

  it("matches the query case-insensitively across title, summary and body", () => {
    expect(filterResources(INVOICE_RESOURCES, { query: "PHISHING" }).map((r) => r.id)).toEqual([
      "spotting-phishing-links",
    ]);
    expect(filterResources(INVOICE_RESOURCES, { query: "nothing-matches-this" })).toEqual([]);
  });

  it("combines query and category", () => {
    expect(filterResources(INVOICE_RESOURCES, { query: "phishing", category: "tips" })).toEqual([]);
  });
});

describe("InvoiceEducationalResources", () => {
  it("lists every resource by default", () => {
    render(<InvoiceEducationalResources />);
    expect(screen.getByText("What is a split invoice?")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(INVOICE_RESOURCES.length);
  });

  it("narrows the list by search and shows an empty state", () => {
    render(<InvoiceEducationalResources />);
    fireEvent.change(screen.getByLabelText("Search resources"), { target: { value: "deadline" } });
    expect(screen.getByText("Choosing a sensible deadline")).toBeInTheDocument();
    expect(screen.queryByText("What is a split invoice?")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search resources"), { target: { value: "zzzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No resources match your search.");
  });

  it("filters by category", () => {
    render(<InvoiceEducationalResources />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "payments" } });
    expect(screen.getByText("Paying an invoice with your wallet")).toBeInTheDocument();
    expect(screen.queryByText("Understanding invoice statuses")).not.toBeInTheDocument();
  });
});
