import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Breadcrumb, { type BreadcrumbItem } from "../Breadcrumb";

vi.mock("next/navigation", () => ({
  usePathname: () => "/invoice/123",
}));

describe("Breadcrumb", () => {
  it("should render breadcrumb items", () => {
    const items: BreadcrumbItem[] = [
      { label: "Invoices", href: "/dashboard" },
      { label: "Invoice #123" },
    ];
    render(<Breadcrumb items={items} />);
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Invoice #123")).toBeInTheDocument();
  });

  it("should not link the last item", () => {
    const items: BreadcrumbItem[] = [
      { label: "Invoices", href: "/dashboard" },
      { label: "Invoice #123" },
    ];
    render(<Breadcrumb items={items} />);
    const lastItem = screen.getByText("Invoice #123");
    expect(lastItem.closest("a")).toBeNull();
  });

  it("should show ellipsis on mobile for more than 2 items", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", href: "/" },
      { label: "Invoices", href: "/dashboard" },
      { label: "Invoice #123" },
    ];
    render(<Breadcrumb items={items} />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("should have proper ARIA attributes", () => {
    const items: BreadcrumbItem[] = [
      { label: "Invoices", href: "/dashboard" },
      { label: "Invoice #123" },
    ];
    const { container } = render(<Breadcrumb items={items} />);
    const nav = container.querySelector("nav[aria-label='Breadcrumb']");
    expect(nav).toBeInTheDocument();
    const list = container.querySelector("ol");
    expect(list).toBeInTheDocument();
  });
});
