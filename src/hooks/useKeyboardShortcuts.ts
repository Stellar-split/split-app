"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Manages global keyboard shortcut state.
 *
 * - Pressing `?` outside a text input/textarea/contenteditable opens the modal.
 * - Exposes `isOpen`, `open()`, and `close()` for imperative control.
 */
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Do not trigger when typing inside an editable element
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable;

      if (isEditable) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { isOpen, open, close };
}
