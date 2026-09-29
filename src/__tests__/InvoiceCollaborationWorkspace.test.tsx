import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceCollaborationWorkspace from "@/components/workspace/InvoiceCollaborationWorkspace";
import { addNote, progress, setRole } from "@/lib/invoiceWorkspace";

const initial = {
  participants: [
    { id: "o", name: "Olu", role: "owner" as const },
    { id: "v", name: "Vee", role: "viewer" as const },
  ],
  notes: [],
  tasks: [{ id: "t1", title: "Confirm amounts", done: false }],
};

describe("invoice collaboration workspace", () => {
  it("blocks viewers from adding notes and protects the owner role", () => {
    const note = { id: "n", authorId: "v", text: "hi", createdAt: "2026-01-01T00:00:00Z" };
    expect(addNote(initial, note)).toBe(initial);
    expect(setRole(initial, "o", "viewer")).toBe(initial);
    expect(progress(initial)).toBe(0);
  });

  it("lets an editor add notes and complete tasks", () => {
    render(<InvoiceCollaborationWorkspace initial={initial} currentUserId="o" />);
    fireEvent.change(screen.getByLabelText("New note"), { target: { value: "Looks good" } });
    fireEvent.click(screen.getByText("Add note"));
    expect(screen.getByText("Looks good")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Confirm amounts"));
    expect(screen.getByText("100% done")).toBeInTheDocument();
  });

  it("is read-only for viewers", () => {
    render(<InvoiceCollaborationWorkspace initial={initial} currentUserId="v" />);
    expect(screen.queryByLabelText("New note")).not.toBeInTheDocument();
    expect(screen.getByText("You have view-only access.")).toBeInTheDocument();
  });
});
