"use client";

import FocusTrap from "@/components/FocusTrap";

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["T"], description: "Toggle theme" },
  { keys: ["?"], description: "Open this shortcuts guide" },
  { keys: ["Esc"], description: "Close modal / dismiss overlay" },
];

interface Props {
  onClose: () => void;
}

/**
 * KeyboardShortcutsModal
 *
 * A full-screen overlay that lists all global keyboard shortcuts.
 * Triggered by pressing `?` outside text inputs, or clicking the `?`
 * icon in the header. Closed by pressing Escape (via FocusTrap) or
 * clicking the backdrop / close button.
 */
export default function KeyboardShortcutsModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-shortcuts-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="relative w-full max-w-lg rounded-2xl border border-gray-700/60 bg-gray-900/95 shadow-2xl shadow-black/60 p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient accent strip */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="px-6 py-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 4a1 1 0 011-1h.01a1 1 0 110 2H12a1 1 0 01-1-1zm0 4a1 1 0 011-1h.01a1 1 0 110 2H12a1 1 0 01-1-1zM5 8a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1zM5 12a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1z"
                    />
                  </svg>
                </span>
                <h2
                  id="kbd-shortcuts-title"
                  className="text-base font-semibold text-gray-100 tracking-tight"
                >
                  Keyboard Shortcuts
                </h2>
              </div>

              <button
                id="kbd-shortcuts-close-btn"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Shortcut table */}
            <table
              className="w-full text-sm border-separate"
              style={{ borderSpacing: "0 4px" }}
              aria-label="Keyboard shortcuts list"
            >
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 pl-3">
                    Shortcut
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-2">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((entry) => (
                  <tr
                    key={entry.description}
                    className="group"
                  >
                    <td className="pl-3 pr-4 py-2.5 rounded-l-lg bg-gray-800/50 group-hover:bg-gray-800 transition-colors w-36">
                      <span className="flex items-center gap-1">
                        {entry.keys.map((k) => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[1.5rem] rounded-md text-xs font-mono font-semibold text-gray-200 bg-gray-700 border border-gray-600 shadow-sm shadow-black/30"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </td>
                    <td className="pr-3 py-2.5 rounded-r-lg bg-gray-800/50 group-hover:bg-gray-800 transition-colors text-gray-300">
                      {entry.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer hint */}
            <p className="mt-5 text-xs text-gray-500 text-center">
              Shortcuts are disabled while typing in text fields.
            </p>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
