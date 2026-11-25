"use client";

import { useState } from "react";
import {
  addNote,
  addTask,
  canEdit,
  progress,
  toggleTask,
  type WorkspaceState,
} from "@/lib/invoiceWorkspace";

export default function InvoiceCollaborationWorkspace({
  initial,
  currentUserId,
}: {
  initial: WorkspaceState;
  currentUserId: string;
}) {
  const [state, setState] = useState<WorkspaceState>(initial);
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const me = state.participants.find((p) => p.id === currentUserId);
  const editable = me ? canEdit(me.role) : false;
  const nameOf = (id: string) => state.participants.find((p) => p.id === id)?.name ?? "Unknown";

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_2fr]" aria-label="Invoice collaboration workspace">
      <aside className="space-y-2">
        <h2 className="font-semibold">Participants</h2>
        <ul className="space-y-1 text-sm">
          {state.participants.map((p) => (
            <li key={p.id} className="flex justify-between rounded border px-2 py-1">
              <span>{p.name}</span>
              <span className="text-gray-500">{p.role}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Checklist</h2>
            <span className="text-sm tabular-nums">{progress(state)}% done</span>
          </div>
          <ul className="mt-2 space-y-1">
            {state.tasks.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={t.done} disabled={!editable} onChange={() => setState(toggleTask(state, t.id))} />
                  <span className={t.done ? "line-through text-gray-500" : ""}>{t.title}</span>
                </label>
              </li>
            ))}
          </ul>
          {editable && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setState(addTask(state, { id: crypto.randomUUID(), title: task, done: false }));
                setTask("");
              }}
            >
              <input aria-label="New task" className="flex-1 rounded border px-2 py-1" value={task} onChange={(e) => setTask(e.target.value)} />
              <button type="submit" className="rounded border px-3 py-1 text-sm">
                Add task
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="font-semibold">Notes</h2>
          <ul className="mt-2 space-y-2">
            {state.notes.map((n) => (
              <li key={n.id} className="rounded border p-2 text-sm">
                <div className="text-xs text-gray-500">{nameOf(n.authorId)}</div>
                {n.text}
              </li>
            ))}
          </ul>
          {editable ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setState(
                  addNote(state, { id: crypto.randomUUID(), authorId: currentUserId, text: note, createdAt: new Date().toISOString() }),
                );
                setNote("");
              }}
            >
              <input aria-label="New note" className="flex-1 rounded border px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="submit" className="rounded border px-3 py-1 text-sm">
                Add note
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-gray-500">You have view-only access.</p>
          )}
        </div>
      </div>
    </section>
  );
}
