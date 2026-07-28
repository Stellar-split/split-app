/**
 * Issue #471 — drag-to-reorder recipients in the split builder.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import SplitCalculator from "@/components/SplitCalculator";
import { moveItem } from "@/lib/reorder";
import type { RecipientLine, SplitMeta } from "@/hooks/useSplitCalculator";

vi.mock("@/lib/addressBook", () => ({
  getEmailForAddress: () => undefined,
}));

function line(address: string, sharePercent: number): RecipientLine {
  return { address, sharePercent, taxRatePercent: 0, fixedFeeXLM: 0 };
}

const recipients = [line("GAAA1", 50), line("GBBB2", 30), line("GCCC3", 20)];

function renderBuilder(onChange?: (m: SplitMeta) => void) {
  return render(
    <SplitCalculator
      splitMeta={{ totalAmount: 100, assetCode: "USDC", recipients }}
      onSplitMetaChange={onChange}
    />
  );
}

/** Addresses in the order they currently appear in the DOM. */
function renderedAddresses(): string[] {
  return screen
    .getAllByPlaceholderText("G...")
    .map((el) => (el as HTMLInputElement).value);
}

/** sharePercent values in DOM order, read off the exact-value number inputs. */
function renderedShares(): number[] {
  return screen
    .getAllByLabelText(/share percentage, exact value/i)
    .map((el) => Number((el as HTMLInputElement).value));
}

describe("moveItem", () => {
  it("moves an item forward and backward without mutating the source", () => {
    const src = ["a", "b", "c"];
    expect(moveItem(src, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(src, 2, 0)).toEqual(["c", "a", "b"]);
    expect(src).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for equal or out-of-range indices", () => {
    const src = ["a", "b", "c"];
    expect(moveItem(src, 1, 1)).toEqual(src);
    expect(moveItem(src, -1, 1)).toEqual(src);
    expect(moveItem(src, 0, 9)).toEqual(src);
  });

  it("preserves object identity so per-row values travel with the row", () => {
    const a = { sharePercent: 50 };
    const b = { sharePercent: 50 };
    const moved = moveItem([a, b], 0, 1);
    expect(moved[1]).toBe(a);
  });
});

describe("SplitCalculator reordering", () => {
  it("renders a drag handle on the leading edge of every row", () => {
    renderBuilder();
    expect(screen.getByTestId("drag-handle-0")).toBeInTheDocument();
    expect(screen.getByTestId("drag-handle-1")).toBeInTheDocument();
    expect(screen.getByTestId("drag-handle-2")).toBeInTheDocument();

    // Leading edge: the handle is the row's first interactive element.
    const row = screen.getByTestId("recipient-row-0");
    expect(row.querySelector("button")).toBe(screen.getByTestId("drag-handle-0"));
  });

  it("reorders rows via drag and drop from the handle", () => {
    renderBuilder();
    expect(renderedAddresses()).toEqual(["GAAA1", "GBBB2", "GCCC3"]);

    const handle = screen.getByTestId("drag-handle-0");
    const source = screen.getByTestId("recipient-row-0");
    const target = screen.getByTestId("recipient-row-2");

    fireEvent.mouseDown(handle);
    fireEvent.dragStart(source);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(renderedAddresses()).toEqual(["GBBB2", "GCCC3", "GAAA1"]);
  });

  it("shows a drop-zone indicator on the row being dragged over", () => {
    renderBuilder();

    fireEvent.mouseDown(screen.getByTestId("drag-handle-0"));
    fireEvent.dragStart(screen.getByTestId("recipient-row-0"));
    fireEvent.dragOver(screen.getByTestId("recipient-row-1"));

    expect(screen.getByTestId("recipient-row-1").className).toMatch(/ring-indigo-500/);
    // The dragged row is dimmed rather than marked as its own drop target.
    expect(screen.getByTestId("recipient-row-0").className).toMatch(/opacity-50/);
    expect(screen.getByTestId("recipient-row-0").className).not.toMatch(/ring-indigo-500/);
  });

  it("reorders with ArrowDown/ArrowUp once the handle has focus", () => {
    renderBuilder();

    const handle = screen.getByTestId("drag-handle-0");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(renderedAddresses()).toEqual(["GBBB2", "GAAA1", "GCCC3"]);

    // Focus follows the moved row so repeated presses keep moving it.
    expect(document.activeElement).toBe(screen.getByTestId("drag-handle-1"));

    fireEvent.keyDown(screen.getByTestId("drag-handle-1"), { key: "ArrowUp" });
    expect(renderedAddresses()).toEqual(["GAAA1", "GBBB2", "GCCC3"]);
  });

  it("does not move past the ends of the list", () => {
    renderBuilder();

    fireEvent.keyDown(screen.getByTestId("drag-handle-0"), { key: "ArrowUp" });
    expect(renderedAddresses()).toEqual(["GAAA1", "GBBB2", "GCCC3"]);

    fireEvent.keyDown(screen.getByTestId("drag-handle-2"), { key: "ArrowDown" });
    expect(renderedAddresses()).toEqual(["GAAA1", "GBBB2", "GCCC3"]);
  });

  it("keeps each recipient's percentage attached to its row when reordering", () => {
    renderBuilder();
    expect(renderedShares()).toEqual([50, 30, 20]);

    fireEvent.keyDown(screen.getByTestId("drag-handle-0"), { key: "ArrowDown" });

    // The 50% row moved to position 2 — values travelled with it, and no
    // redistribution happened.
    expect(renderedAddresses()).toEqual(["GBBB2", "GAAA1", "GCCC3"]);
    expect(renderedShares()).toEqual([30, 50, 20]);
  });

  it("includes the new order in the serialized split payload", () => {
    const onChange = vi.fn();
    renderBuilder(onChange);

    fireEvent.keyDown(screen.getByTestId("drag-handle-0"), { key: "ArrowDown" });

    const lastPayload = onChange.mock.calls[onChange.mock.calls.length - 1][0] as SplitMeta;
    expect(lastPayload.recipients.map((r) => r.address)).toEqual([
      "GBBB2",
      "GAAA1",
      "GCCC3",
    ]);
    expect(lastPayload.recipients.map((r) => r.sharePercent)).toEqual([30, 50, 20]);
  });

  it("announces keyboard moves to assistive technology", () => {
    renderBuilder();
    fireEvent.keyDown(screen.getByTestId("drag-handle-0"), { key: "ArrowDown" });
    expect(
      screen.getByText(/moved from position 1 to position 2 of 3/i)
    ).toBeInTheDocument();
  });

  it("omits drag handles in read-only mode", () => {
    render(
      <SplitCalculator
        splitMeta={{ totalAmount: 100, assetCode: "USDC", recipients }}
        readOnly
      />
    );
    expect(screen.queryByTestId("drag-handle-0")).not.toBeInTheDocument();
  });
});
