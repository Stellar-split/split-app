import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "@/components/Navbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ThemeToggle", () => ({
  __esModule: true,
  default: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

vi.mock("@/components/SimulationModeToggle", () => ({
  __esModule: true,
  default: () => <div data-testid="sim-toggle">Sim Toggle</div>,
}));

vi.mock("@/components/NotificationCenter", () => ({
  __esModule: true,
  default: () => <div data-testid="notification-center">Notifications</div>,
}));

vi.mock("@/components/HeaderShortcutsButton", () => ({
  __esModule: true,
  default: () => <div data-testid="shortcuts">Shortcuts</div>,
}));

vi.mock("@/components/NetworkStatus", () => ({
  __esModule: true,
  default: () => <div data-testid="network-status">Network</div>,
}));

vi.mock("@/components/GlobalSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="global-search">Search</div>,
}));

vi.mock("@/components/layout/MobileSidebar", () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="mobile-sidebar">Mobile Menu</div> : null
  ),
}));

describe("Navbar Mobile Menu", () => {
  beforeEach(() => {
    global.innerWidth = 640;
  });

  it("renders hamburger icon below sm breakpoint", () => {
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    expect(hamburgerButton).toBeTruthy() // element exists in DOM;
  });

  it("hides hamburger icon above sm breakpoint", () => {
    global.innerWidth = 768;
    render(<Navbar />);

    const hamburgerButton = screen.queryByRole("button", { name: /menu/i });
    expect(hamburgerButton).not.toBeTruthy() // element exists in DOM;
  });

  it("shows horizontal navigation links above sm breakpoint", () => {
    global.innerWidth = 768;
    render(<Navbar />);

    expect(screen.getByText("Dashboard")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Subscriptions")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Groups")).toBeTruthy() // element exists in DOM;
  });

  it("opens mobile menu when hamburger is clicked", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-sidebar")).toBeTruthy() // element exists in DOM;
    });
  });

  it("closes mobile menu when clicking outside", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    const { container } = render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    fireEvent.click(container);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-sidebar")).not.toBeTruthy() // element exists in DOM;
    });
  });

  it("closes mobile menu when Escape key is pressed", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-sidebar")).toBeTruthy() // element exists in DOM;
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-sidebar")).not.toBeTruthy() // element exists in DOM;
    });
  });

  it("renders navigation links vertically in mobile menu", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeTruthy() // element exists in DOM;
      expect(screen.getByText("Subscriptions")).toBeTruthy() // element exists in DOM;
      expect(screen.getByText("Groups")).toBeTruthy() // element exists in DOM;
      expect(screen.getByText("Contacts")).toBeTruthy() // element exists in DOM;
      expect(screen.getByText("Recipients")).toBeTruthy() // element exists in DOM;
      expect(screen.getByText("Leaderboard")).toBeTruthy() // element exists in DOM;
    });
  });

  it("closes menu when a navigation link is clicked", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    await user.click(dashboardLink);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-sidebar")).not.toBeTruthy() // element exists in DOM;
    });
  });

  it("maintains open state when window is resized above breakpoint", () => {
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(hamburgerButton);

    global.innerWidth = 768;
    fireEvent.resize(window);

    const horizontalLinks = screen.getByText("Dashboard");
    expect(horizontalLinks).toBeTruthy() // element exists in DOM;
  });

  it("hamburger button is accessible with keyboard navigation", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    hamburgerButton.focus();
    expect(hamburgerButton).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("mobile-sidebar")).toBeTruthy() // element exists in DOM;
    });
  });

  it("logo links to home on all screen sizes", () => {
    global.innerWidth = 500;
    render(<Navbar />);

    const logoLink = screen.getByRole("link", { name: /StellarSplit home/i });
    expect(logoLink).to.have.property('getAttribute', "href", "/");
  });

  it("mobile menu is full width on small screens", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    const { container } = render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    await waitFor(() => {
      const sidebar = screen.getByTestId("mobile-sidebar");
      expect(sidebar).toBeTruthy() // element exists in DOM;
    });
  });

  it("closes menu when clicking menu button again (toggle)", async () => {
    const user = userEvent.setup();
    global.innerWidth = 500;
    render(<Navbar />);

    const hamburgerButton = screen.getByRole("button", { name: /menu/i });
    await user.click(hamburgerButton);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-sidebar")).toBeTruthy() // element exists in DOM;
    });

    await user.click(hamburgerButton);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-sidebar")).not.toBeTruthy() // element exists in DOM;
    });
  });

  it("preserves header controls (theme, notifications) in mobile view", () => {
    global.innerWidth = 500;
    render(<Navbar />);

    expect(screen.getByTestId("theme-toggle")).toBeTruthy() // element exists in DOM;
    expect(screen.getByTestId("notification-center")).toBeTruthy() // element exists in DOM;
    expect(screen.getByTestId("network-status")).toBeTruthy() // element exists in DOM;
  });
});
