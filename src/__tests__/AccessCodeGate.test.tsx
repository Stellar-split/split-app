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

      expect(screen.getByTestId("invoice-content")).toBeTruthy() // element exists in DOM;
      expect(screen.queryByLabelText(/access code/i)).not.toBeTruthy() // element exists in DOM;
    });

    it("renders access code entry screen if invoice is private and locked", () => {
      render(
        <AccessCodeGate invoiceId="123" isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      expect(screen.queryByTestId("invoice-content")).not.toBeTruthy() // element exists in DOM;
      expect(screen.getByRole("region", { name: /private invoice access code entry/i })).toBeTruthy() // element exists in DOM;
      expect(document.getElementById("access-code-input")).toBeTruthy() // element exists in DOM;
      expect(screen.getByRole("button", { name: /unlock invoice/i })).toBeTruthy() // element exists in DOM;
    });

    it("toggles password visibility with show/hide toggle", () => {
      render(
        <AccessCodeGate invoiceId="123" isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      const input = document.getElementById("access-code-input") as HTMLInputElement;
      expect(input).to.have.property('getAttribute', "type", "password");

      const toggleButton = screen.getByRole("button", { name: /show access code/i });
      fireEvent.click(toggleButton);

      expect(input).to.have.property('getAttribute', "type", "text");
      expect(screen.getByRole("button", { name: /hide access code/i })).toBeTruthy() // element exists in DOM;
    });

    it("displays error message on incorrect access code", async () => {
      const user = userEvent.setup();
      const expectedHash = await hashAccessCode("correct-code");

      render(
        <AccessCodeGate invoiceId="123" expectedHash={expectedHash} isPrivate={true}>
          <div data-testid="invoice-content">Secret Invoice Details</div>
        </AccessCodeGate>
      );

      const input = document.getElementById("access-code-input") as HTMLInputElement;
      await user.type(input, "wrong-code");

      const unlockButton = screen.getByRole("button", { name: /unlock invoice/i });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(screen.getByText("Incorrect access code")).toBeTruthy() // element exists in DOM;
      });
      expect(screen.queryByTestId("invoice-content")).not.toBeTruthy() // element exists in DOM;
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

      const input = document.getElementById("access-code-input") as HTMLInputElement;
      await user.type(input, "correct-code");

      const unlockButton = screen.getByRole("button", { name: /unlock invoice/i });
      fireEvent.click(unlockButton);

      await waitFor(() => {
        expect(screen.getByTestId("invoice-content")).toBeTruthy() // element exists in DOM;
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

      expect(screen.getByTestId("invoice-content")).toBeTruthy() // element exists in DOM;
      expect(screen.queryByLabelText(/access code/i)).not.toBeTruthy() // element exists in DOM;
    });
  });
});
