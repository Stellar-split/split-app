/**
 * Issue #468 — split ratio sliders with real-time sum validation.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import SplitCalculator from "@/components/SplitCalculator";
import SplitSumIndicator from "@/components/invoice/SplitSumIndicator";
import type { RecipientLine, SplitMeta } from "@/hooks/useSplitCalculator";

vi.mock("@/lib/addressBook", () => ({
  getEmailForAddress: () => undefined,
}));

function line(address: string, sharePercent: number): RecipientLine {
  return { address, sharePercent, taxRatePercent: 0, fixedFeeXLM: 0 };
}

function renderBuilder(recipients: RecipientLine[], onChange?: (m: SplitMeta) => void) {
  return render(
    <SplitCalculator
      splitMeta={{ totalAmount: 100, assetCode: "USDC", recipients }}
      onSplitMetaChange={onChange}
    />
  );
}

function sliders(): HTMLInputElement[] {
  return screen.getAllByLabelText(
    /^Recipient \d+ share percentage$/i
  ) as HTMLInputElement[];
}

describe("SplitSumIndicator", () => {
  it("turns green only at exactly 100%", () => {
    const { rerender } = render(<SplitSumIndicator sum={100} isValid />);
    expect(screen.getByTestId("split-sum-bar")).to.have.property('getAttribute', "data-state", "valid");
    expect(screen.getByTestId("split-sum-bar").className).toMatch(/bg-emerald-500/);

    rerender(<SplitSumIndicator sum={99.9} isValid={false} />);
    expect(screen.getByTestId("split-sum-bar")).to.have.property('getAttribute', "data-state", "under");
    expect(screen.getByTestId("split-sum-bar").className).toMatch(/bg-red-500/);

    rerender(<SplitSumIndicator sum={120} isValid={false} />);
    expect(screen.getByTestId("split-sum-bar")).to.have.property('getAttribute', "data-state", "over");
    expect(screen.getByTestId("split-sum-bar").className).toMatch(/bg-red-500/);
  });

  it("reports how much is left to allocate, or the overage", () => {
    const { rerender } = render(<SplitSumIndicator sum={70} isValid={false} />);
    expect(screen.getByText(/30% left to allocate/i)).toBeTruthy() // element exists in DOM;

    rerender(<SplitSumIndicator sum={115} isValid={false} />);
    expect(screen.getByText(/over-allocated by 15%/i)).toBeTruthy() // element exists in DOM;
  });

  it("exposes progressbar semantics", () => {
    render(<SplitSumIndicator sum={40} isValid={false} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).to.have.property('getAttribute', "aria-valuenow", "40");
    expect(bar).to.have.property('getAttribute', "aria-valuemin", "0");
    expect(bar).to.have.property('getAttribute', "aria-valuemax", "100");
  });
});

describe("SplitCalculator sliders", () => {
  it("renders a slider per recipient row", () => {
    renderBuilder([line("GAAA1", 60), line("GBBB2", 40)]);
    const all = sliders();
    expect(all).toHaveLength(2);
    expect(all[0]).to.have.property('getAttribute', "type", "range");
    expect(all[0]).to.have.property('value', "60");
    expect(all[1]).to.have.property('value', "40");
  });

  it("updates that recipient's percentage in real time", () => {
    renderBuilder([line("GAAA1", 60), line("GBBB2", 40)]);

    fireEvent.change(sliders()[0], { target: { value: "75" } });

    expect(sliders()[0]).to.have.property('value', "75");
    const indicator = screen.getByTestId("split-sum-indicator");
    expect(within(indicator).getByText("115% / 100%")).toBeTruthy() // element exists in DOM;
  });

  it("does not redistribute the remainder to other recipients", () => {
    renderBuilder([line("GAAA1", 50), line("GBBB2", 30), line("GCCC3", 20)]);

    fireEvent.change(sliders()[0], { target: { value: "10" } });

    // Only the adjusted row changes; the other two keep their values even
    // though the split is now under-allocated.
    expect(sliders().map((s) => s.value)).toEqual(["10", "30", "20"]);
  });

  it("steps by 1% so arrow keys give whole-percent increments", () => {
    renderBuilder([line("GAAA1", 100)]);
    expect(sliders()[0]).to.have.property('getAttribute', "step", "1");
    expect(sliders()[0]).to.have.property('getAttribute', "min", "0");
    expect(sliders()[0]).to.have.property('getAttribute', "max", "100");
  });

  it("keeps a paired exact-value field for sub-1% precision", () => {
    renderBuilder([line("GAAA1", 33.3333), line("GBBB2", 66.6667)]);

    const exact = screen.getAllByLabelText(
      /share percentage, exact value/i
    ) as HTMLInputElement[];
    expect(exact[0]).to.have.property('value', 33.3333);

    fireEvent.change(exact[0], { target: { value: "33.5" } });
    expect(exact[0]).to.have.property('value', 33.5);
  });

  it("marks the split valid only when the shares total exactly 100", () => {
    const onChange = vi.fn();
    renderBuilder([line("GAAA1", 50), line("GBBB2", 50)], onChange);

    expect(screen.getByTestId("split-sum-bar")).to.have.property('getAttribute', "data-state", "valid");

    fireEvent.change(sliders()[0], { target: { value: "51" } });
    expect(screen.getByTestId("split-sum-bar")).to.have.property('getAttribute', "data-state", "over");
    expect(
      screen.getByText(/share percentages must sum to 100%/i)
    ).toBeTruthy() // element exists in DOM;
  });
});
