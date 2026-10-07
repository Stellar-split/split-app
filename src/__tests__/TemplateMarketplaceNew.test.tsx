import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import TemplateMarketplace from "@/components/TemplateMarketplace";
import type { UserTemplate } from "@/components/TemplateManager";

const noop = vi.fn();

describe("TemplateMarketplace (#799)", () => {
  beforeEach(() => noop.mockClear());

  it("renders the marketplace heading", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    expect(screen.getByText("Template Marketplace")).toBeInTheDocument();
  });

  it("renders featured templates", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    expect(screen.getByText(/featured/i)).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    expect(screen.getByPlaceholderText(/search templates/i)).toBeInTheDocument();
  });

  it("renders category filter", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
  });

  it("renders sort selector", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it("shows templates in a list", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    // Should have multiple template cards
    const importButtons = screen.getAllByRole("button", { name: /^import$/i });
    expect(importButtons.length).toBeGreaterThan(0);
  });

  it("filters by search query", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const search = screen.getByPlaceholderText(/search templates/i);
    fireEvent.change(search, { target: { value: "retainer" } });
    expect(screen.getByRole("heading", { name: /agency retainer/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /consulting day rate/i })).not.toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const select = screen.getByLabelText(/filter by category/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Consulting" } });
    expect(screen.getByRole("heading", { name: /consulting day rate/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /agency retainer/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const search = screen.getByPlaceholderText(/search templates/i);
    fireEvent.change(search, { target: { value: "zzznomatch999" } });
    expect(screen.getByText(/no templates match/i)).toBeInTheDocument();
  });

  it("calls onImport with correct UserTemplate when Import is clicked", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const importButtons = screen.getAllByRole("button", { name: /^import$/i });
    fireEvent.click(importButtons[0]);
    expect(noop).toHaveBeenCalledTimes(1);
    const arg = noop.mock.calls[0][0] as UserTemplate;
    expect(arg).toHaveProperty("name");
    expect(arg).toHaveProperty("recipients");
    expect(arg).toHaveProperty("token");
  });

  it("shows Imported ✓ after importing", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const importButtons = screen.getAllByRole("button", { name: /^import$/i });
    fireEvent.click(importButtons[0]);
    expect(screen.getAllByRole("button", { name: /imported/i }).length).toBeGreaterThan(0);
  });

  it("disables Import button for already-imported templates", () => {
    // All template names; we supply an ID we know exists
    render(<TemplateMarketplace onImport={noop} importedIds={new Set(["Freelance Design Sprint"])} />);
    const disabledBtns = screen
      .getAllByRole("button", { name: /imported/i })
      .filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabledBtns.length).toBeGreaterThan(0);
  });

  it("opens preview modal on Preview click", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const previewButtons = screen.getAllByRole("button", { name: /preview/i });
    fireEvent.click(previewButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes preview modal on Close click", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const previewButtons = screen.getAllByRole("button", { name: /preview/i });
    fireEvent.click(previewButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preview modal shows recipient breakdown", () => {
    render(<TemplateMarketplace onImport={noop} importedIds={new Set()} />);
    const previewButtons = screen.getAllByRole("button", { name: /preview/i });
    fireEvent.click(previewButtons[0]);
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/recipients/i)).toBeInTheDocument();
    expect(within(modal).getByText(/total/i)).toBeInTheDocument();
  });
});
