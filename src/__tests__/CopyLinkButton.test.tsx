import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CopyLinkButton from "@/components/CopyLinkButton";

const URL = "https://stellarsplit.app/i/42";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("CopyLinkButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in the idle state", () => {
    mockClipboard();
    render(<CopyLinkButton url={URL} />);

    expect(
      screen.getByRole("button", { name: /copy verification link/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
  });

  it("switches to the success state and announces after a successful copy", async () => {
    const writeText = mockClipboard();
    render(<CopyLinkButton url={URL} />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy verification link/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Copied!")).toBeInTheDocument()
    );

    expect(writeText).toHaveBeenCalledWith(URL);

    // Icon swap: the checkmark replaces the link icon.
    const button = screen.getByRole("button", { name: /copied/i });
    expect(button.querySelector("svg")).toBeTruthy();

    // Green success styling for the 2s window.
    expect(button.className).toContain("bg-green-600");

    // Screen-reader announcement.
    expect(screen.getByText("Link copied")).toBeInTheDocument();
  });

  it("exposes a polite live region for the announcement", () => {
    mockClipboard();
    const { container } = render(<CopyLinkButton url={URL} />);

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent("");
  });
});
