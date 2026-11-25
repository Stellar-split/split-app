import InvoiceCollaborationWorkspace from "@/components/workspace/InvoiceCollaborationWorkspace";

export default function InvoiceWorkspacePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Collaboration workspace</h1>
      <InvoiceCollaborationWorkspace initial={{ participants: [], notes: [], tasks: [] }} currentUserId="" />
    </main>
  );
}
