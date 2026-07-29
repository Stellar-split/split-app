import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BulkTagModal from "@/components/invoice/BulkTagModal";

// ── Helpers ───────────────────────────────────────────────────────────────

const SELECTED_IDS = ["inv-001", "inv-002", "inv-003"];
const EXISTING_TAGS = ["design", "q1-2026", "client-a"];

function renderModal(overrides: Partial<Parameters<typeof BulkTagModal>[0]> = {}) {
  const onClose = vi.fn();
  const onOptimisticUpdate = vi.fn();
  const onRollback = vi.fn();
  const onError = vi.fn();

  const utils = render(
    <BulkTagModal
      selectedIds={SELECTED_IDS}
      existingTags={EXISTING_TAGS}
      onClose={onClose}
      onOptimisticUpdate={onOptimisticUpdate}
      onRollback={onRollback}
      onError={onError}
      {...overrides}
    />
  );

  return { ...utils, onClose, onOptimisticUpdate, onRollback, onError };
}

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        success: true,
        count: SELECTED_IDS.length,
        addedTags: ["urgent"],
        updated: {},
      }),
  } as Response);
}

function mockFetchFail(errorMsg = "Server error") {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: errorMsg }),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetchOk());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("BulkTagModal", () => {
  it("renders the modal with correct invoice count", () => {
    renderModal();

    expect(
      screen.getByText(`Add tags to ${SELECTED_IDS.length} invoices`)
    ).toBeInTheDocument();
  });

  it("uses singular 'invoice' for count of 1", () => {
    renderModal({ selectedIds: ["inv-001"] });

    expect(screen.getByText("Add tags to 1 invoice")).toBeInTheDocument();
  });

  it("renders TagInput for entering tags", () => {
    renderModal();

    expect(
      screen.getByRole("combobox")
    ).toBeInTheDocument();
  });

  it("confirm button is disabled when no tags are entered", () => {
    renderModal();

    expect(
      screen.getByTestId("bulk-tag-confirm")
    ).toBeDisabled();
  });

  it("confirm button is enabled after entering a tag", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByRole("combobox");
    await user.type(input, "urgent{Enter}");

    expect(screen.getByTestId("bulk-tag-confirm")).not.toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the X button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: /close modal/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    // The backdrop is the outermost dialog container
    const backdrop = screen.getByRole("dialog");
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onOptimisticUpdate immediately on confirm before API returns", async () => {
    const user = userEvent.setup();

    // Slow fetch — never resolves during the test assertion
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {}))
    );

    const { onOptimisticUpdate, onClose } = renderModal();

    const input = screen.getByRole("combobox");
    await user.type(input, "urgent{Enter}");
    await user.click(screen.getByTestId("bulk-tag-confirm"));

    // Optimistic update fires before fetch resolves
    expect(onOptimisticUpdate).toHaveBeenCalledWith(
      SELECTED_IDS,
      expect.arrayContaining(["urgent"])
    );

    // Modal closes immediately
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends PATCH /api/invoices/bulk with correct body", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchOk();
    vi.stubGlobal("fetch", fetchSpy);

    renderModal();

    const input = screen.getByRole("combobox");
    await user.type(input, "urgent{Enter}");
    await user.click(screen.getByTestId("bulk-tag-confirm"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/invoices/bulk",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"addTags"'),
        })
      );
    });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(callBody.ids).toEqual(SELECTED_IDS);
    expect(callBody.addTags).toContain("urgent");
  });

  it("calls onRollback and onError when the API call fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockFetchFail("Bulk tag failed"));

    const { onRollback, onError } = renderModal();

    const input = screen.getByRole("combobox");
    await user.type(input, "urgent{Enter}");
    await user.click(screen.getByTestId("bulk-tag-confirm"));

    await waitFor(() => {
      expect(onRollback).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith("Bulk tag failed");
    });
  });

  it("does not call onRollback on success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockFetchOk());

    const { onRollback } = renderModal();

    const input = screen.getByRole("combobox");
    await user.type(input, "urgent{Enter}");
    await user.click(screen.getByTestId("bulk-tag-confirm"));

    await waitFor(() => {
      expect(onRollback).not.toHaveBeenCalled();
    });
  });

  it("shows confirm button label with selected count", async () => {
    renderModal();

    expect(
      screen.getByTestId("bulk-tag-confirm")
    ).toHaveTextContent(`Apply to ${SELECTED_IDS.length} invoices`);
  });

  it("displays a note that existing tags are preserved", () => {
    renderModal();

    expect(
      screen.getByText(/existing tags are preserved/i)
    ).toBeInTheDocument();
  });
});
