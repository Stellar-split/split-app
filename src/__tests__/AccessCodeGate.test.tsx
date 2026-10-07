import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import AccessCodeGate, { hashAccessCode, verifyAccessCode } from "@/components/invoice/AccessCodeGate";

describe("AccessCodeGate & Hash Verification", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("hashAccessCode & verifyAccessCode", () => {
    it("hashes an access code to a 64-character SHA-256 hex string", async () => {
      const hash1 = await hashAccessCode("my-secret-code");
      const hash2 = await hashAccessCode("my-secret-code");

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it("verifies matching access code against stored hash", async () => {
      const code = "Stellar2026!";
      const hash = await hashAccessCode(code);

      const isValid = await verifyAccessCode(code, hash);
      expect(isValid).toBe(true);
    });

    it("rejects non-matching access code", async () => {
      const code = "Stellar2026!";
      const hash = await hashAccessCode(code);

      const isValid = await verifyAccessCode("wrong-code", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("AccessCodeGate component", () => {
    it("renders children directly if invoice is not private", () => {
      render(
        <AccessCodeGate invoiceId="123" isPrivate={false}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      expect(screen.getByTestId("invoice-content")).toBeInTheDocument();
      expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
    });

    it("renders access code entry screen if invoice is private and locked", () => {
      render(
        <AccessCodeGate invoiceId="123" isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      expect(screen.queryByTestId("invoice-content")).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: /private invoice access code entry/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/access code/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /unlock invoice/i })).toBeInTheDocument();
    });

    it("toggles password visibility with show/hide toggle", () => {
      render(
        <AccessCodeGate invoiceId="123" isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      const input = screen.getByLabelText(/access code/i);
      expect(input).toHaveAttribute("type", "password");

      const toggleButton = screen.getByRole("button", { name: /show access code/i });
      fireEvent.click(toggleButton);

      expect(input).toHaveAttribute("type", "text");
      expect(screen.getByRole("button", { name: /hide access code/i })).toBeInTheDocument();
    });

    it("displays error message on incorrect access code", async () => {
      const user = userEvent.setup();
      const expectedHash = await hashAccessCode("correct-code");

      render(
        <AccessCodeGate invoiceId="123" expectedHash={expectedHash} isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      const input = screen.getByLabelText(/access code/i);
      await user.type(input, "wrong-code");

      const unlockButton = screen.getByRole("button", { name: /unlock invoice/i });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(screen.getByText("Incorrect access code")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("invoice-content")).not.toBeInTheDocument();
    });

    it("unlocks and persists to sessionStorage on correct code", async () => {
      const user = userEvent.setup();
      const onUnlock = vi.fn();
      const expectedHash = await hashAccessCode("correct-code");

      render(
        <AccessCodeGate
          invoiceId="123"
          expectedHash={expectedHash}
          isPrivate={true}
          onUnlock={onUnlock}
        >
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      const input = screen.getByLabelText(/access code/i);
      await user.type(input, "correct-code");

      const unlockButton = screen.getByRole("button", { name: /unlock invoice/i });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(screen.getByTestId("invoice-content")).toBeInTheDocument();
      });

      expect(onUnlock).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem("invoice_unlocked_123")).toBe("true");
    });

    it("restores unlocked state from sessionStorage on mount", () => {
      sessionStorage.setItem("invoice_unlocked_123", "true");

      render(
        <AccessCodeGate invoiceId="123" isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      expect(screen.getByTestId("invoice-content")).toBeInTheDocument();
      expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
    });
  });
});
