import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CommandPalette, { fuzzyMatch } from "@/components/CommandPalette";

const navigateSpy = jest.fn();

beforeEach(() => {
  navigateSpy.mockClear();
});

jest.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: function MockFocusTrap({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose?: () => void;
  }) {
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

describe("fuzzyMatch", () => {
  test("exact substring match scores higher than fuzzy", () => {
    const exact = fuzzyMatch("dash", "Dashboard");
    const fuzzy = fuzzyMatch("dshb", "Dashboard");
    expect(exact).toBeGreaterThan(fuzzy);
  });

  test("returns 0 when characters don't appear in order", () => {
    expect(fuzzyMatch("zqx", "Dashboard")).toBe(0);
  });

  test("empty query matches everything", () => {
    expect(fuzzyMatch("", "Dashboard")).toBeGreaterThan(0);
  });

  test("full match scores highly", () => {
    expect(fuzzyMatch("dashboard", "Dashboard")).toBeGreaterThan(1);
  });
});

describe("CommandPalette — open/close", () => {
  test("Cmd+K opens the palette", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    pressKey("k", document, { metaKey: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("Ctrl+K opens the palette", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);

    pressKey("k", document, { ctrlKey: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("Escape closes the palette", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);

    pressKey("k", document, { metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pressKey("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Cmd+K toggles the palette closed", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);

    pressKey("k", document, { metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pressKey("k", document, { metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CommandPalette — fuzzy search", () => {
  test("typing filters results by match quality", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.change(input, { target: { value: "dash" } });
    });

    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveTextContent("Dashboard");
  });

  test("clicking a result navigates to its route", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.change(input, { target: { value: "dashboard" } });
    });

    const item = screen.getAllByRole("option")[0];
    act(() => {
      item.click();
    });

    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  test("no results message shows for unmatched query", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.change(input, { target: { value: "zzzzzzzznotfound" } });
    });

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });
});

describe("CommandPalette — keyboard navigation", () => {
  test("arrow keys change the active result", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    const optionsAfter = screen.getAllByRole("option");
    expect(optionsAfter[1]).toHaveAttribute("aria-selected", "true");
    expect(optionsAfter[0]).toHaveAttribute("aria-selected", "false");
  });

  test("ArrowUp from first wraps to last", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowUp" });
    });

    const options = screen.getAllByRole("option");
    const lastOption = options[options.length - 1];
    expect(lastOption).toHaveAttribute("aria-selected", "true");
  });
});

describe("CommandPalette — parameterized action", () => {
  test("'Go to invoice #' action shows inline ID prompt", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.change(input, { target: { value: "go to invoice" } });
    });

    const invoiceOption = screen.getAllByRole("option").find((el) =>
      el.textContent?.includes("Go to invoice")
    );
    expect(invoiceOption).toBeDefined();

    act(() => {
      invoiceOption!.click();
    });

    expect(screen.getByText(/Go to invoice #/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter invoice id/i)).toBeInTheDocument();
  });

  test("entering an ID and pressing Enter navigates to the invoice", () => {
    render(<CommandPalette onNavigate={navigateSpy} />);
    pressKey("k", document, { metaKey: true });

    const input = screen.getByLabelText(/search pages/i);
    act(() => {
      fireEvent.change(input, { target: { value: "go to invoice" } });
    });

    const invoiceOption = screen.getAllByRole("option").find((el) =>
      el.textContent?.includes("Go to invoice")
    );
    act(() => {
      invoiceOption!.click();
    });

    const paramInput = screen.getByPlaceholderText(/enter invoice id/i);
    act(() => {
      fireEvent.change(paramInput, { target: { value: "42" } });
      fireEvent.keyDown(paramInput, { key: "Enter" });
    });

    expect(navigateSpy).toHaveBeenCalledWith("/invoice/42");
  });
});
