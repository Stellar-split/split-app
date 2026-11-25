"use client";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";

/**
 * HeaderShortcutsButton
 *
 * Renders the `?` icon button in the header and mounts the
 * KeyboardShortcutsModal when open. Placed in the header by the root layout.
 * The modal is also opened by pressing `?` (handled in useKeyboardShortcuts).
 */
export default function HeaderShortcutsButton() {
  const { isOpen, open, close } = useKeyboardShortcuts();

  return (
    <>
      <button
        id="kbd-shortcuts-trigger"
        onClick={open}
        aria-label="Show keyboard shortcuts"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Keyboard shortcuts (?)"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-700/60 border border-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm font-semibold select-none"
      >
        ?
      </button>

      {isOpen && <KeyboardShortcutsModal onClose={close} />}
    </>
  );
}
