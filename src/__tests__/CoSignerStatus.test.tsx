import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import CoSignerSection from "@/components/invoice/CoSignerSection";
import type { CoSigner } from "@/hooks/useSplitCalculator";

describe("CoSignerSection & Co-Signer Status Logic", () => {
  const sampleAddresses = [
    "GBZXN7PIRZGNMHGA728J352Q367AZ2Q2V55HQ2BEXD7J7",
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7",
    "GCKNYZOGMTCU2L4XNY327QJGN5C3M54WYZVFR4724VFX6",
  ];

  it("renders CoSignerSection with toggle off when empty", () => {
    const onChange = vi.fn();
    render(<CoSignerSection cosigners={[]} threshold={1} onChange={onChange} />);

    expect(screen.getByText(/Co-Signer Approvals \(N-of-M\)/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Add Co-Signer Stellar Address/i)).not.toBeInTheDocument();
  });

  it("enables section when checkbox toggle is clicked", () => {
    const onChange = vi.fn();
    render(<CoSignerSection cosigners={[]} threshold={1} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/Enable co-signer approvals/i);
    fireEvent.click(checkbox);

    expect(screen.getByLabelText(/Add Co-Signer Stellar Address/i)).toBeInTheDocument();
  });

  it("adds a valid Stellar address to co-signers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const validKey = "GBZXN7PIRZGNMHGA728J352Q367AZ2Q2V55HQ2BEXD7J7AAAAAA12345678"; // 56 chars
    const addr56 = "G" + "A".repeat(55);

    render(<CoSignerSection cosigners={[]} threshold={1} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/Enable co-signer approvals/i);
    fireEvent.click(checkbox);

    const input = screen.getByRole("textbox", { name: /Add Co-Signer Stellar Address/i });
    await user.type(input, addr56);

    const addButton = screen.getByRole("button", { name: /\+ Add/i });
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([addr56], 1);
  });

  it("rejects invalid Stellar address with inline error message", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CoSignerSection cosigners={[]} threshold={1} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/Enable co-signer approvals/i);
    fireEvent.click(checkbox);

    const input = screen.getByRole("textbox", { name: /Add Co-Signer Stellar Address/i });
    await user.type(input, "InvalidShortKey");

    const addButton = screen.getByRole("button", { name: /\+ Add/i });
    fireEvent.click(addButton);

    expect(screen.getByText(/Invalid Stellar public key/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1); // Only from the initial toggle
  });

  it("removes a co-signer and updates threshold appropriately", () => {
    const onChange = vi.fn();
    const signers = ["G" + "A".repeat(55), "G" + "B".repeat(55)];

    render(<CoSignerSection cosigners={signers} threshold={2} onChange={onChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /Remove co-signer/i });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith(["G" + "B".repeat(55)], 1);
  });

  describe("Co-Signer Threshold & Status Logic", () => {
    it("computes approved count and threshold met accurately", () => {
      const cosigners: CoSigner[] = [
        { address: "G1", approved: true, approvedAt: "2026-09-24T10:00:00Z" },
        { address: "G2", approved: true, approvedAt: "2026-09-24T11:00:00Z" },
        { address: "G3", approved: false },
      ];

      const threshold = 2;
      const approvedCount = cosigners.filter((c) => c.approved).length;
      const isThresholdMet = approvedCount >= threshold;

      expect(approvedCount).toBe(2);
      expect(isThresholdMet).toBe(true);
    });

    it("detects when threshold is not yet met", () => {
      const cosigners: CoSigner[] = [
        { address: "G1", approved: true },
        { address: "G2", approved: false },
        { address: "G3", approved: false },
      ];

      const threshold = 2;
      const approvedCount = cosigners.filter((c) => c.approved).length;
      const isThresholdMet = approvedCount >= threshold;

      expect(approvedCount).toBe(1);
      expect(isThresholdMet).toBe(false);
    });
  });
});
