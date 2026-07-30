"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder as FolderIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Folder } from "@/lib/folders";

interface Props {
  folders: Folder[];
  /** null selects "All Invoices". */
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  /** invoiceId → folder ids, used to show a per-folder invoice count. */
  counts?: Record<string, number>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * FolderSidebar — "All Invoices" root plus the list of user-created folders.
 * Supports inline create, rename and delete.
 */
export default function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  counts = {},
  collapsed = false,
  onToggleCollapsed,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const totalCount = Object.values(counts).reduce((s, c) => s + c, 0);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName("");
      return;
    }
    setBusy(true);
    try {
      await onCreate(name);
      setNewName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (id: string) => {
    const name = editingName.trim();
    setEditingId(null);
    if (!name) return;
    setBusy(true);
    try {
      await onRename(id, name);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this folder? Invoices in it will not be deleted.")) return;
    setBusy(true);
    try {
      await onDelete(id);
      if (selectedFolderId === id) onSelect(null);
    } finally {
      setBusy(false);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        aria-label="Expand folder sidebar"
        className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    );
  }

  return (
    <nav aria-label="Folders" className="w-full sm:w-56 shrink-0 bg-gray-900 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Folders
        </span>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            aria-label="Collapse folder sidebar"
            className="p-1 rounded text-gray-500 hover:text-gray-300"
          >
            <ChevronDown size={14} />
          </button>
        )}
      </div>

      <ul className="space-y-0.5">
        <li>
          <button
            onClick={() => onSelect(null)}
            className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
              selectedFolderId === null
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            <span>All Invoices</span>
            <span className="text-xs text-gray-500">{totalCount}</span>
          </button>
        </li>

        {folders.map((folder) => (
          <li key={folder.id} className="group">
            {editingId === folder.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => submitRename(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename(folder.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full px-2 py-1.5 rounded-lg text-sm bg-gray-800 border border-indigo-500 text-gray-100 outline-none"
              />
            ) : (
              <div
                className={`flex items-center gap-1 px-1 py-0.5 rounded-lg transition-colors ${
                  selectedFolderId === folder.id ? "bg-indigo-600/20" : "hover:bg-gray-800"
                }`}
              >
                <button
                  onClick={() => onSelect(folder.id)}
                  className={`flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-sm text-left truncate ${
                    selectedFolderId === folder.id ? "text-indigo-300" : "text-gray-300"
                  }`}
                >
                  <FolderIcon size={14} className="shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
                <span className="text-xs text-gray-500 shrink-0">{counts[folder.id] ?? 0}</span>
                <button
                  onClick={() => {
                    setEditingId(folder.id);
                    setEditingName(folder.name);
                  }}
                  aria-label={`Rename ${folder.name}`}
                  disabled={busy}
                  className="p-1 rounded text-gray-500 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDelete(folder.id)}
                  aria-label={`Delete ${folder.name}`}
                  disabled={busy}
                  className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="flex items-center gap-1 mt-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Folder name"
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-sm bg-gray-800 border border-indigo-500 text-gray-100 outline-none"
          />
          <button
            onClick={submitCreate}
            disabled={busy}
            aria-label="Confirm new folder"
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            aria-label="Cancel new folder"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} /> New Folder
        </button>
      )}
    </nav>
  );
}
