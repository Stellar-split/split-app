import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AuditLogViewer from "@/components/audit/AuditLogViewer";
import { auditEntriesToCsv, filterAuditEntries, type AuditEntry } from "@/lib/auditLog";

const entries: AuditEntry[] = [
  { id: "1", timestamp: 1000, actor: "GALICE", action: "Invoice created", category: "invoice", target: "INV-1" },
  { id: "2", timestamp: 3000, actor: "GBOB", action: "Signed in", category: "auth" },
  { id: "3", timestamp: 2000, actor: "GALICE", action: "Payment sent", category: "payment", details: 'note, "quoted"' },
];

describe("auditLog", () => {
  it("sorts newest first and filters by category, query and range", () => {
    expect(filterAuditEntries(entries).map((e) => e.id)).toEqual(["2", "3", "1"]);
    expect(filterAuditEntries(entries, { category: "auth" }).map((e) => e.id)).toEqual(["2"]);
    expect(filterAuditEntries(entries, { query: "inv-1" }).map((e) => e.id)).toEqual(["1"]);
    expect(filterAuditEntries(entries, { from: 1500, to: 2500 }).map((e) => e.id)).toEqual(["3"]);
  });

  it("escapes CSV cells", () => {
    const csv = auditEntriesToCsv([entries[2]]);
    expect(csv.split("\n")[1]).toContain('"note, ""quoted"""');
  });
});

describe("AuditLogViewer", () => {
  it("renders entries and filters by search and category", () => {
    render(<AuditLogViewer entries={entries} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Search audit log"), { target: { value: "signed" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "payment" } });
    expect(screen.getByText(/No audit entries/)).toBeInTheDocument();
  });
});
