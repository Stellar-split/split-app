"use client";

import { useCallback, useEffect, useState } from "react";
import { FILTER_PRESET_NAME_MAX_LENGTH, type FilterPreset } from "@/lib/types/filterPreset";

const STORAGE_KEY = "invoiceFilterPresets";

function readPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(presets: FilterPreset[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — preset just
    // won't persist for this session.
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export interface UseFilterPresetsResult {
  presets: FilterPreset[];
  /** Returns an error message on failure (duplicate name, empty, too long), or null on success. */
  savePreset: (name: string, filters: Record<string, string>) => string | null;
  renamePreset: (id: string, name: string) => string | null;
  deletePreset: (id: string) => void;
}

export function useFilterPresets(): UseFilterPresetsResult {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    setPresets(readPresets());
  }, []);

  const validateName = useCallback(
    (name: string, excludeId?: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return "Preset name is required";
      if (trimmed.length > FILTER_PRESET_NAME_MAX_LENGTH) {
        return `Preset name must be ${FILTER_PRESET_NAME_MAX_LENGTH} characters or fewer`;
      }
      const collides = presets.some(
        (p) => p.id !== excludeId && normalizeName(p.name) === normalizeName(trimmed)
      );
      if (collides) return "A preset with this name already exists";
      return null;
    },
    [presets]
  );

  const savePreset = useCallback(
    (name: string, filters: Record<string, string>): string | null => {
      const error = validateName(name);
      if (error) return error;

      const preset: FilterPreset = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: name.trim(),
        filters,
        createdAt: new Date().toISOString(),
      };
      const next = [...presets, preset];
      setPresets(next);
      writePresets(next);
      return null;
    },
    [presets, validateName]
  );

  const renamePreset = useCallback(
    (id: string, name: string): string | null => {
      const error = validateName(name, id);
      if (error) return error;

      const next = presets.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
      setPresets(next);
      writePresets(next);
      return null;
    },
    [presets, validateName]
  );

  const deletePreset = useCallback(
    (id: string) => {
      const next = presets.filter((p) => p.id !== id);
      setPresets(next);
      writePresets(next);
    },
    [presets]
  );

  return { presets, savePreset, renamePreset, deletePreset };
}
