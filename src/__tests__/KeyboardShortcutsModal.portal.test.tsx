/**
 * Unit tests for the KeyboardShortcutsModal overlay container.
 *
 * Covers the fix for the header `?` button appearing to "do nothing": the
 * overlay is `fixed inset-0`, but it is mounted from the header, which sets a
 * `backdrop-blur`, making the header a containing block for `position: fixed`
 * descendants. That confined the overlay to the header box instead of the
 * viewport, so it must be portalled to `document.body`.
 *
 * Covers:
 *  - the dialog renders outside the host that mounted the trigger (portal)
 *  - the dialog is attached to `document.body`
 *  - categories render in a stable order (Navigation, Invoices, Payments, General)
 *  - each section's `aria-labelledby` resolves to a real, DOM-id-safe element
 *  - the close button still dismisses the overlay
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HeaderShortcutsButton from "@/components/HeaderShortcutsButton";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";
import {
  ShortcutRegistryProvider,
  useRegisterShortcuts,
} from "@/context/ShortcutRegistry";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithRegistry(ui: React.ReactElement) {
  return render(<ShortcutRegistryProvider>{ui}</ShortcutRegistryProvider>);
}

function openViaButton() {
  act(() => {
    screen.getByRole("button", { name: /keyboard shortcuts/i }).click();
  });
}

describe("KeyboardShortcutsModal overlay container", () => {
  test("renders the dialog outside the host that mounted the header button", () => {
    const { container } = renderWithRegistry(
      <div data-testid="header-host">
        <HeaderShortcutsButton />
      </div>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    openViaButton();

    const dialog = screen.getByRole("dialog");

    // The overlay must not live inside the header host — that is exactly what
    // broke `fixed inset-0` under the header's `backdrop-blur`.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.parentElement).toBe(document.body);
  });

  test("keeps the ? button in the header while the overlay is portalled out", () => {
    const { container } = renderWithRegistry(
      <div data-testid="header-host">
        <HeaderShortcutsButton />
      </div>
    );

    openViaButton();

    expect(
      container.querySelector('[aria-label="Show keyboard shortcuts"]')
    ).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test("close button still dismisses the portalled overlay", () => {
    renderWithRegistry(<HeaderShortcutsButton />);

    openViaButton();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: /close keyboard shortcuts/i }).click();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("KeyboardShortcutsModal category grouping", () => {
  function Registrar() {
    useRegisterShortcuts([
      {
        id: "test:general",
        keys: ["X"],
        description: "General entry",
        group: "General",
        handler: () => {},
      },
      {
        id: "test:payments",
        keys: ["P"],
        description: "Payments entry",
        group: "Payments",
        handler: () => {},
      },
      {
        id: "test:navigation",
        keys: ["Y"],
        description: "Navigation entry",
        group: "Navigation",
        handler: () => {},
      },
      {
        id: "test:invoices",
        keys: ["I"],
        description: "Invoices entry",
        group: "Invoices",
        handler: () => {},
      },
      {
        id: "test:extra",
        keys: ["Z"],
        description: "Extras entry",
        group: "Zebra Extras",
        handler: () => {},
      },
    ]);
    return null;
  }

  function renderGrouped() {
    return renderWithRegistry(
      <>
        <Registrar />
        <KeyboardShortcutsModal onClose={() => {}} />
      </>
    );
  }

  test("leads with the documented categories and keeps General last", () => {
    renderGrouped();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    expect(headings[0]).toBe("Navigation");
    expect(headings[1]).toBe("Invoices");
    expect(headings[2]).toBe("Payments");
    expect(headings[headings.length - 1]).toBe("General");
    // Uncategorised extras sort between the lead categories and General.
    expect(headings).toContain("Zebra Extras");
    expect(headings.indexOf("Zebra Extras")).toBeLessThan(
      headings.indexOf("General")
    );
  });

  test("section aria-labelledby resolves to a DOM-id-safe heading", () => {
    renderGrouped();

    const sections = Array.from(
      document.body.querySelectorAll("section[aria-labelledby]")
    );
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      const id = section.getAttribute("aria-labelledby")!;
      // Multi-word categories must not produce an id with whitespace.
      expect(id).toMatch(/^kbd-group-[a-z0-9-]+$/);
      expect(id.split(/\s+/)).toHaveLength(1);
      const heading = document.getElementById(id);
      expect(heading).not.toBeNull();
      expect(section.contains(heading)).toBe(true);
    }

    // `Zebra Extras` slugifies rather than emitting an unusable space.
    expect(document.getElementById("kbd-group-zebra-extras")).not.toBeNull();
  });

  test("renders every registered entry so nothing is silently dropped", () => {
    renderGrouped();

    for (const label of [
      "Navigation entry",
      "Invoices entry",
      "Payments entry",
      "Zebra Extras entry",
      "General entry",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
