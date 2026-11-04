import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, fireEvent } from "@testing-library/react";
import AdvancedPaymentMethodPicker, { DEFAULT_PAYMENT_METHODS } from "@/components/AdvancedPaymentMethodPicker";

describe("AdvancedPaymentMethodPicker", () => {
  it("selects a method on click", () => {
    const onChange = vi.fn();
    render(<AdvancedPaymentMethodPicker value="freighter" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /Freighter wallet/ })).to.have.property('getAttribute', "aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Batch payment/ }));
    expect(onChange).toHaveBeenCalledWith("batch");
  });

  it("skips disabled methods with arrow keys", () => {
    const onChange = vi.fn();
    const methods = DEFAULT_PAYMENT_METHODS.map((m) =>
      m.id === "batch" ? { ...m, disabled: true, disabledReason: "Unavailable" } : m
    );
    render(<AdvancedPaymentMethodPicker value="freighter" onChange={onChange} methods={methods} />);
    expect(screen.getByText("Unavailable")).toBeTruthy() // element exists in DOM;
    fireEvent.keyDown(screen.getByRole("radio", { name: /Freighter wallet/ }), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("crossChain");
  });
});
