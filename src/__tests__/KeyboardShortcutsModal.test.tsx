/**
 * Unit tests for KeyboardShortcutsModal (#<issue>).
 *
 * Covers:
 *  - `?` keypress outside inputs opens the modal
 *  - `?` keypress inside <input> is suppressed
 *  - `?` keypress inside <textarea> is suppressed
 *  - Escape closes the modal (delegated to FocusTrap)
 *  - Header `?` button opens the modal
 *  - Modal close button dismisses the modal
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HeaderShortcutsButton from "@/components/HeaderShortcutsButton";

// ── mock FocusTrap ─────────────────────────────────────────────────────────────
// Renders children transparently and calls onClose when Escape is pressed
jest.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose?: () => void;
  }) => {
    // Simulate Escape handling (FocusTrap does this natively)
    React.useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose?.();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    return <>{children}</>;
  },
}));

// Helper: fire a keydown on a given target element (defaults to document)
function pressKey(
  key: string,
  target: EventTarget = document,
  options: KeyboardEventInit = {}
) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...options })
    );
  });
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe("KeyboardShortcutsModal — ? key trigger", () => {
  test("pressing ? outside an input opens the modal", () => {
    render(<HeaderShortcutsButton />);

    expect(screen.queryByRole("dialog")).toBeNull();

    pressKey("?");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Keyboard Shortcuts")
    ).toBeInTheDocument();
  });

  test("pressing ? a second time closes the modal (toggle)", () => {
    render(<HeaderShortcutsButton />);

    pressKey("?");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pressKey("?");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("pressing ? inside an <input> does NOT open the modal", () => {
    render(
      <div>
        <HeaderShortcutsButton />
        <input data-testid="text-input" />
      </div>
    );

    const input = screen.getByTestId("text-input");
    pressKey("?", input);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("pressing ? inside a <textarea> does NOT open the modal", () => {
    render(
      <div>
        <HeaderShortcutsButton />
        <textarea data-testid="text-area" />
      </div>
    );

    const textarea = screen.getByTestId("text-area");
    pressKey("?", textarea);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("KeyboardShortcutsModal — Escape closes the modal", () => {
  test("pressing Escape closes the open modal", () => {
    render(<HeaderShortcutsButton />);

    pressKey("?");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pressKey("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("KeyboardShortcutsModal — header button", () => {
  test("clicking the ? header button opens the modal", () => {
    render(<HeaderShortcutsButton />);

    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      screen.getByRole("button", { name: /keyboard shortcuts/i }).click();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("clicking the close (×) button inside the modal dismisses it", () => {
    render(<HeaderShortcutsButton />);

    act(() => {
      screen.getByRole("button", { name: /keyboard shortcuts/i }).click();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: /close keyboard shortcuts/i }).click();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("KeyboardShortcutsModal — shortcut list content", () => {
  test("modal displays the required shortcut entries", () => {
    render(<HeaderShortcutsButton />);
    pressKey("?");

    // Check the four mandatory shortcuts from the acceptance criteria
    expect(screen.getByText("Open command palette")).toBeInTheDocument();
    expect(screen.getByText("Focus search")).toBeInTheDocument();
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
    expect(screen.getByText(/close modal/i)).toBeInTheDocument();
  });
});
