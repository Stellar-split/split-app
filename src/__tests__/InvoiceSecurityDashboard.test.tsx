import React from "react";
import { render, screen } from "@testing-library/react";
import InvoiceSecurityDashboard from "@/components/security/InvoiceSecurityDashboard";
import { levelForScore, summarizeInvoiceSecurity, type InvoiceSecurityEvent } from "@/lib/invoiceSecurity";

const events: InvoiceSecurityEvent[] = [
  { id: "1", invoiceId: "INV-1", kind: "failed_auth", timestamp: 1 },
  { id: "2", invoiceId: "INV-1", kind: "large_payment", timestamp: 2 },
  { id: "3", invoiceId: "INV-2", kind: "export", timestamp: 3 },
];

describe("invoiceSecurity", () => {
  it("scores 100 with no events", () => {
    const summary = summarizeInvoiceSecurity([]);
    expect(summary.score).toBe(100);
    expect(summary.level).toBe("good");
    expect(summary.riskiestInvoices).toEqual([]);
  });

  it("weights events, counts by kind and ranks invoices by risk", () => {
    const summary = summarizeInvoiceSecurity(events);
    expect(summary.score).toBe(100 - 5 - 10 - 1);
    expect(summary.countsByKind.failed_auth).toBe(1);
    expect(summary.riskiestInvoices).toEqual([
      { invoiceId: "INV-1", risk: 15, events: 2 },
      { invoiceId: "INV-2", risk: 1, events: 1 },
    ]);
  });

  it("never drops below zero and maps score to a level", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      invoiceId: "INV-X",
      kind: "large_payment" as const,
      timestamp: i,
    }));
    const summary = summarizeInvoiceSecurity(many);
    expect(summary.score).toBe(0);
    expect(summary.level).toBe("at_risk");
    expect(levelForScore(79)).toBe("attention");
    expect(levelForScore(80)).toBe("good");
  });

  it("includes suspicious-activity alerts in the score", () => {
    const activity = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, actor: "GA", amount: 10 + i, timestamp: i * 1000 }));
    const summary = summarizeInvoiceSecurity([], activity);
    expect(summary.alerts.length).toBeGreaterThan(0);
    expect(summary.score).toBeLessThan(100);
  });
});

describe("InvoiceSecurityDashboard", () => {
  it("renders the score, counts and riskiest invoices", () => {
    render(<InvoiceSecurityDashboard events={events} />);
    expect(screen.getByRole("status")).toHaveTextContent("84");
    expect(screen.getByText("Failed sign-ins")).toBeInTheDocument();
    expect(screen.getByText("INV-1")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<InvoiceSecurityDashboard events={[]} />);
    expect(screen.getByText("No security events recorded.")).toBeInTheDocument();
  });
});
