"use client";

import { useRef, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useFilterPresets } from "@/hooks/useFilterPresets";
import { FILTER_PRESET_NAME_MAX_LENGTH } from "@/lib/types/filterPreset";

interface Props {
  /** Current filter+sort state, serialized the same way it's written to the URL. */
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}

/**
 * "Save as preset" button + dropdown of saved filter presets for the
 * invoice dashboard. Presets are plain URL-query dictionaries so applying
 * one is just re-writing the dashboard's query string.
 */
export default function FilterPresetDropdown({ currentFilters, onApply }: Props) {
  const { presets, savePreset, renamePreset, deletePreset } = useFilterPresets();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = Object.values(currentFilters).some((v) => v);

  const handleSave = () => {
    const err = savePreset(nameInput, currentFilters);
    if (err) {
      setError(err);
      return;
    }
    setSaving(false);
    setNameInput("");
    setError(null);
  };

  const handleRename = (id: string) => {
    const err = renamePreset(id, renameInput);
    if (err) {
      setError(err);
      return;
    }
    setRenamingId(null);
    setRenameInput("");
    setError(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1.5 min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Presets
          {presets.length > 0 && (
            <span className="rounded-full bg-indigo-600 text-white text-xs px-1.5 py-0.5">{presets.length}</span>
          )}
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSaving(true);
            setOpen(true);
            setError(null);
          }}
          disabled={!hasActiveFilters}
          className="min-h-9 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save as preset
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute z-40 mt-2 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-3 flex flex-col gap-2"
        >
          {saving && (
            <div className="flex flex-col gap-1 pb-2 border-b border-gray-200 dark:border-gray-800">
              <label htmlFor="preset-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Preset name
              </label>
              <input
                id="preset-name"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                maxLength={FILTER_PRESET_NAME_MAX_LENGTH}
                className="min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Overdue this month"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSaving(false);
                    setNameInput("");
                    setError(null);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {presets.length === 0 && !saving && (
            <p className="text-sm text-gray-500 py-2 text-center">No saved presets yet.</p>
          )}

          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-1 group">
              {renamingId === preset.id ? (
                <>
                  <input
                    autoFocus
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(preset.id)}
                    maxLength={FILTER_PRESET_NAME_MAX_LENGTH}
                    className="flex-1 min-h-8 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(preset.id)}
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onApply(preset.filters);
                      setOpen(false);
                    }}
                    className="flex-1 text-left min-h-8 px-2 py-1 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors truncate"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${preset.name}`}
                    onClick={() => {
                      setRenamingId(preset.id);
                      setRenameInput(preset.name);
                      setError(null);
                    }}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${preset.name}`}
                    onClick={() => deletePreset(preset.id)}
                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {renamingId === preset.id && error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 self-end"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
