"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Folder as FolderIcon, Minus, Plus } from "lucide-react";
import type { Folder } from "@/lib/folders";

interface Props {
  /** One invoice id for a per-card menu, or several for a bulk toolbar action. */
  invoiceIds: string[];
  folders: Folder[];
  foldersByInvoice: Record<string, string[]>;
  assignFolders: (invoiceId: string, folderIds: string[]) => Promise<string[]>;
  createFolder: (name: string) => Promise<Folder>;
  onClose: () => void;
}

type MembershipState = "all" | "some" | "none";

function membershipFor(folderId: string, invoiceIds: string[], byInvoice: Record<string, string[]>): MembershipState {
  const withFolder = invoiceIds.filter((id) => (byInvoice[id] ?? []).includes(folderId));
  if (withFolder.length === 0) return "none";
  if (withFolder.length === invoiceIds.length) return "all";
  return "some";
}

/**
 * AssignFolderMenu — popover for assigning one or many invoices to folders.
 * Used both from a per-invoice-card button and the multi-select bulk toolbar.
 */
export default function AssignFolderMenu({
  invoiceIds,
  folders,
  foldersByInvoice,
  assignFolders,
  createFolder,
  onClose,
}: Props) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const toggleFolder = async (folderId: string, state: MembershipState) => {
    setBusy(true);
    try {
      const addingEverywhere = state !== "all";
      await Promise.all(
        invoiceIds.map((invoiceId) => {
          const current = foldersByInvoice[invoiceId] ?? [];
          const next = addingEverywhere
            ? Array.from(new Set([...current, folderId]))
            : current.filter((id) => id !== folderId);
          return assignFolders(invoiceId, next);
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAssign = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const folder = await createFolder(name);
      await Promise.all(
        invoiceIds.map((invoiceId) => {
          const current = foldersByInvoice[invoiceId] ?? [];
          return assignFolders(invoiceId, [...current, folder.id]);
        })
      );
      setNewName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label="Assign to folder"
      className="absolute z-50 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-lg p-2"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-2 py-1">
        Add to folder
      </div>

      <ul className="max-h-56 overflow-y-auto space-y-0.5">
        {folders.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-gray-500">No folders yet.</li>
        )}
        {folders.map((folder) => {
          const state = membershipFor(folder.id, invoiceIds, foldersByInvoice);
          return (
            <li key={folder.id}>
              <button
                role="menuitemcheckbox"
                aria-checked={state === "all"}
                disabled={busy}
                onClick={() => toggleFolder(folder.id, state)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left text-gray-200 hover:bg-gray-800 disabled:opacity-50"
              >
                <span
                  className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 ${
                    state === "none" ? "border-gray-600" : "border-indigo-500 bg-indigo-600/30"
                  }`}
                >
                  {state === "all" && <Check size={11} className="text-indigo-300" />}
                  {state === "some" && <Minus size={11} className="text-indigo-300" />}
                </span>
                <FolderIcon size={13} className="text-gray-500 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-800">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateAndAssign();
          }}
          placeholder="New folder…"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 text-gray-100 outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleCreateAndAssign}
          disabled={busy || !newName.trim()}
          aria-label="Create and assign folder"
          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </div>

      <button
        onClick={onClose}
        className="w-full mt-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
      >
        Done
      </button>
    </div>
  );
}
