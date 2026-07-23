/**
 * Unit tests for TransferOwnershipModal:
 * - Double-entry address validation (submit disabled until both fields match)
 * - Calls onConfirm with the correct address when valid
 * - Prevents submission when addresses mismatch
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TransferOwnershipModal from "@/components/TransferOwnershipModal";

jest.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: function FocusTrap({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
}));

const NEW_OWNER = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";

describe("TransferOwnershipModal — double-entry validation", () => {
  it("disables submit when both fields are empty", () => {
    const onConfirm = jest.fn();
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    const submit = screen.getByRole("button", { name: /transfer ownership/i });
    expect(submit).toBeDisabled();
  });

  it("disables submit when only the first field is filled", () => {
    const onConfirm = jest.fn();
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^new owner address$/i), {
      target: { value: NEW_OWNER },
    });
    expect(screen.getByRole("button", { name: /transfer ownership/i })).toBeDisabled();
  });

  it("disables submit when addresses do not match", () => {
    const onConfirm = jest.fn();
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^new owner address$/i), {
      target: { value: NEW_OWNER },
    });
    fireEvent.change(screen.getByLabelText(/confirm new owner address/i), {
      target: { value: "GDIFFERENT" },
    });
    expect(screen.getByRole("button", { name: /transfer ownership/i })).toBeDisabled();
    expect(screen.getByText(/addresses do not match/i)).toBeInTheDocument();
  });

  it("enables submit when both addresses match", () => {
    const onConfirm = jest.fn();
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^new owner address$/i), {
      target: { value: NEW_OWNER },
    });
    fireEvent.change(screen.getByLabelText(/confirm new owner address/i), {
      target: { value: NEW_OWNER },
    });
    expect(screen.getByRole("button", { name: /transfer ownership/i })).not.toBeDisabled();
  });

  it("calls onConfirm with the trimmed address when submitted", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^new owner address$/i), {
      target: { value: `  ${NEW_OWNER}  ` },
    });
    fireEvent.change(screen.getByLabelText(/confirm new owner address/i), {
      target: { value: `  ${NEW_OWNER}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer ownership/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(NEW_OWNER));
  });
});

describe("TransferOwnershipModal — error handling", () => {
  it("shows error message when onConfirm rejects", async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error("Network error"));
    render(
      <TransferOwnershipModal invoiceId="inv-1" onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.change(screen.getByLabelText(/^new owner address$/i), {
      target: { value: NEW_OWNER },
    });
    fireEvent.change(screen.getByLabelText(/confirm new owner address/i), {
      target: { value: NEW_OWNER },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer ownership/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Error: Network error")
    );
  });
});
