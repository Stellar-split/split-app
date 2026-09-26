import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

function TestConsumer() {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
      <button onClick={() => setTheme("light")}>Set Light</button>
      <button onClick={() => setTheme("system")}>Set System</button>
      <button onClick={cycleTheme}>Cycle</button>
    </div>
  );
}

describe("ThemeProvider & ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with default system mode and applies data-theme attribute", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists theme change to localStorage and sets data-theme attribute", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const lightButton = screen.getByText("Set Light");
    act(() => {
      fireEvent.click(lightButton);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("split-theme")).toBe("light");
  });

  it("restores theme from localStorage on initial render", () => {
    localStorage.setItem("split-theme", "light");

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("ThemeToggle cycles through all 3 modes: light -> dark -> system", () => {
    localStorage.setItem("split-theme", "light");

    render(
      <ThemeProvider>
        <ThemeToggle />
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");

    const toggle = screen.getByRole("button", { name: /switch to dark mode/i });
    act(() => {
      fireEvent.click(toggle);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");

    act(() => {
      fireEvent.click(toggle);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("system");

    act(() => {
      fireEvent.click(toggle);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
  });
});
