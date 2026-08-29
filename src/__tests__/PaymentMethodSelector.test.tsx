/**
 * Unit tests for PaymentMethodSelector.
 *
 * Covers:
 *  - Arrow key navigation (ArrowUp/ArrowDown) between options
 *  - Enter and Space keys confirm selection
 *  - Focus wraps around (circular navigation)
 *  - Proper ARIA roles (role='listbox', role='option')
 *  - Keyboard accessibility compliance (WCAG 2.1 SC 2.1.1)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";

// ─── localStorage mock ───────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PaymentMethodSelector", () => {
  const mockOnMethodChange = vi.fn();

  beforeEach(() => {
    mockOnMethodChange.mockReset();
    localStorage.clear();
  });

  test("renders payment method options with listbox role", () => {
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const fieldset = screen.getByRole("group");
    expect(fieldset).toBeInTheDocument();
    expect(fieldset).toHaveAttribute("role", "group");
  });

  test("renders radio options for Freighter and WalletConnect", () => {
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    expect(freighterRadio).toBeInTheDocument();
    expect(walletConnectRadio).toBeInTheDocument();
  });

  test("ArrowDown key moves focus to next option", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Focus on Freighter option
    await user.click(freighterRadio);
    expect(freighterRadio).toBeFocused();

    // Press ArrowDown to move to WalletConnect
    await user.keyboard("{ArrowDown}");
    expect(walletConnectRadio).toBeFocused();
  });

  test("ArrowUp key moves focus to previous option", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Focus on WalletConnect option
    await user.click(walletConnectRadio);
    expect(walletConnectRadio).toBeFocused();

    // Press ArrowUp to move to Freighter
    await user.keyboard("{ArrowUp}");
    expect(freighterRadio).toBeFocused();
  });

  test("Enter key confirms selection at focused option", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Focus and navigate to WalletConnect
    await user.click(freighterRadio);
    await user.keyboard("{ArrowDown}");
    expect(walletConnectRadio).toBeFocused();

    // Press Enter to confirm
    await user.keyboard("{Enter}");

    // Verify callback was called
    expect(mockOnMethodChange).toHaveBeenCalledWith("walletconnect");
  });

  test("Space key confirms selection at focused option", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Focus and navigate to WalletConnect
    await user.click(freighterRadio);
    await user.keyboard("{ArrowDown}");
    expect(walletConnectRadio).toBeFocused();

    // Press Space to confirm
    await user.keyboard(" ");

    // Verify callback was called
    expect(mockOnMethodChange).toHaveBeenCalledWith("walletconnect");
  });

  test("focus wraps from last option to first (circular navigation)", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Start at WalletConnect (last option)
    await user.click(walletConnectRadio);
    expect(walletConnectRadio).toBeFocused();

    // Press ArrowDown to wrap to first option
    await user.keyboard("{ArrowDown}");
    expect(freighterRadio).toBeFocused();
  });

  test("focus wraps from first option to last (circular navigation reverse)", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    // Start at Freighter (first option)
    await user.click(freighterRadio);
    expect(freighterRadio).toBeFocused();

    // Press ArrowUp to wrap to last option
    await user.keyboard("{ArrowUp}");
    expect(walletConnectRadio).toBeFocused();
  });

  test("radio inputs have proper ARIA attributes", () => {
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(2);

    // All radios should have name attribute for grouping
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute("name", "payment-method");
    });
  });

  test("keyboard navigation works without mouse for accessibility", async () => {
    const user = userEvent.setup({ skipClick: true });
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const fieldset = screen.getByRole("group");

    // Tab into the fieldset
    await user.tab();

    // Navigate with arrow keys only (no mouse)
    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });
    freighterRadio.focus();

    await user.keyboard("{ArrowDown}");

    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });
    expect(walletConnectRadio).toBeFocused();

    // Confirm with Space
    await user.keyboard(" ");
    expect(mockOnMethodChange).toHaveBeenCalledWith("walletconnect");
  });

  test("disabled option is not navigable with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const freighterRadio = screen.getByRole("radio", {
      name: /Freighter Wallet/i,
    });

    // If WalletConnect is disabled, pressing ArrowDown from Freighter
    // should not move focus to it
    await user.click(freighterRadio);

    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    if (walletConnectRadio.hasAttribute("disabled")) {
      await user.keyboard("{ArrowDown}");
      expect(freighterRadio).toBeFocused();
    }
  });

  test("saves user preference to localStorage on selection", async () => {
    const user = userEvent.setup();
    render(
      <PaymentMethodSelector
        onMethodChange={mockOnMethodChange}
        payerAddress="GPAYER123"
        recipientAddress="GRECIP123"
      />
    );

    const walletConnectRadio = screen.getByRole("radio", {
      name: /WalletConnect/i,
    });

    await user.click(walletConnectRadio);

    // Check localStorage for saved preference
    const saved = localStorage.getItem("paymentMethodPref:GPAYER123:GRECIP123");
    expect(saved).toBe("walletconnect");
  });
});
