import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import CoCreatorPanel, {
  loadPermissions,
  type PermissionLevel,
} from "@/components/CoCreatorPanel";

jest.mock("@/lib/stellar", () => ({
  splitClient: {
    addCoCreator: jest.fn().mockResolvedValue(undefined),
    removeCoCreator: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@stellar-split/sdk", () => ({
  truncateAddress: (addr: string) => addr.slice(0, 4) + "…",
}));

const CREATOR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const COCREATOR_VIEW = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const COCREATOR_EDIT = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const COCREATOR_ADMIN = "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function makeInvoice(coCreators: string[] = []) {
  return {
    id: "test-invoice-1",
    creator: CREATOR,
    recipients: [{ address: "GRECIP", amount: 1000n }],
    token: "USDC",
    deadline: Math.floor(Date.now() / 1000) + 86400,
    funded: 0n,
    status: "Pending" as const,
    payments: [],
    coCreators,
  };
}

describe("CoCreatorPanel — permission levels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("creator sees add co-creator form (admin-level access)", () => {
    render(
      <CoCreatorPanel
        invoice={makeInvoice()}
        publicKey={CREATOR}
        onUpdate={async () => {}}
      />
    );
    expect(screen.getByLabelText(/add co-creator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/permission level/i)).toBeInTheDocument();
  });

  test("view-level co-creator cannot see add form or remove buttons", () => {
    const invoice = makeInvoice([COCREATOR_VIEW]);
    render(
      <CoCreatorPanel
        invoice={invoice}
        publicKey={COCREATOR_VIEW}
        onUpdate={async () => {}}
      />
    );
    expect(screen.queryByLabelText(/add co-creator/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    expect(screen.getByText(/view-only access/i)).toBeInTheDocument();
  });

  test("edit-level co-creator cannot manage co-creators", () => {
    const invoice = makeInvoice([COCREATOR_EDIT]);
    localStorage.setItem(
      `coCreatorPermissions:${invoice.id}`,
      JSON.stringify([{ address: COCREATOR_EDIT, permissionLevel: "edit" }])
    );
    render(
      <CoCreatorPanel
        invoice={invoice}
        publicKey={COCREATOR_EDIT}
        onUpdate={async () => {}}
      />
    );
    expect(screen.queryByLabelText(/add co-creator/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  test("admin-level co-creator can see add form and remove buttons", () => {
    const invoice = makeInvoice([COCREATOR_ADMIN]);
    localStorage.setItem(
      `coCreatorPermissions:${invoice.id}`,
      JSON.stringify([{ address: COCREATOR_ADMIN, permissionLevel: "admin" }])
    );
    render(
      <CoCreatorPanel
        invoice={invoice}
        publicKey={COCREATOR_ADMIN}
        onUpdate={async () => {}}
      />
    );
    expect(screen.getByLabelText(/add co-creator/i)).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  test("adding a co-creator stores the selected permission level", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <CoCreatorPanel
        invoice={makeInvoice()}
        publicKey={CREATOR}
        onUpdate={onUpdate}
      />
    );

    const addressInput = screen.getByLabelText(/add co-creator/i);
    const permSelect = screen.getByLabelText(/permission level/i);

    fireEvent.change(addressInput, { target: { value: COCREATOR_VIEW } });
    fireEvent.change(permSelect, { target: { value: "edit" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add co-creator/i }));
    });

    await waitFor(() => {
      const stored = loadPermissions("test-invoice-1");
      expect(stored).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            address: COCREATOR_VIEW,
            permissionLevel: "edit",
          }),
        ])
      );
    });
  });

  test("non-co-creator non-creator sees nothing", () => {
    const invoice = makeInvoice([COCREATOR_VIEW]);
    const { container } = render(
      <CoCreatorPanel
        invoice={invoice}
        publicKey="GRANDOMADDRESS12345678901234567890123456789012345678901"
        onUpdate={async () => {}}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  test("permission enforcement disclaimer is shown", () => {
    render(
      <CoCreatorPanel
        invoice={makeInvoice()}
        publicKey={CREATOR}
        onUpdate={async () => {}}
      />
    );
    expect(screen.getByText(/client-side only/i)).toBeInTheDocument();
  });
});
