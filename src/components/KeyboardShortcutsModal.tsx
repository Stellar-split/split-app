"use client";

import { useMemo } from "react";
import FocusTrap from "@/components/FocusTrap";
import { useShortcutRegistry, type ShortcutDefinition } from "@/context/ShortcutRegistry";

interface Props {
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Group shortcuts by their `group` field.
 * Groups are returned in the order they first appear in the registry,
 * with "General" always first when present.
 */
function groupShortcuts(
  shortcuts: ShortcutDefinition[],
): Array<{ group: string; entries: ShortcutDefinition[] }> {
  const map = new Map<string, ShortcutDefinition[]>();

  // Always seed General first so it stays at the top
  map.set("General", []);

  for (const s of shortcuts) {
    // Hide internal chord-activation entries from the overlay
    if (s.id === "global:g-chord") continue;

    const group = s.group ?? "General";
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(s);
  }

  // Remove empty groups
  return Array.from(map.entries())
    .filter(([, entries]) => entries.length > 0)
    .map(([group, entries]) => ({ group, entries }));
}

// ── Kbd chip ──────────────────────────────────────────────────────────────────

function KbdKey({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[1.5rem] rounded-md text-xs font-mono font-semibold text-gray-200 bg-gray-700 border border-gray-600 shadow-sm shadow-black/30">
      {label}
    </kbd>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

/**
 * KeyboardShortcutsModal
 *
 * A help overlay that lists **all shortcuts registered via ShortcutRegistry**.
 * Shortcuts are grouped by their `group` field (defaults to "General").
 *
 * Triggered by pressing `?` outside text inputs, or clicking the `?` icon in
 * the header. Closed by pressing Escape (handled in useKeyboardShortcuts) or
 * clicking the backdrop / close button.
 *
 * Components register shortcuts with `useRegisterShortcuts` — the overlay
 * automatically reflects additions and removals without any manual wiring.
 */
export default function KeyboardShortcutsModal({ onClose }: Props) {
  const { shortcuts } = useShortcutRegistry();
  const grouped = useMemo(() => groupShortcuts(shortcuts), [shortcuts]);

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
          className="relative w-full max-w-lg rounded-2xl border border-gray-700/60 bg-gray-900/95 shadow-2xl shadow-black/60 overflow-hidden max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient accent strip */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shrink-0" />

          <div className="px-6 pt-5 pb-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h4M6 16h12" />
                  </svg>
                </span>
                <div>
                  <h2
                    id="kbd-shortcuts-title"
                    className="text-base font-semibold text-gray-100 tracking-tight"
                  >
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {shortcuts.length} shortcut{shortcuts.length !== 1 ? "s" : ""} registered
                  </p>
                </div>
              </div>

              <button
                id="kbd-shortcuts-close-btn"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Grouped shortcut sections */}
            {grouped.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No shortcuts registered.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(({ group, entries }) => (
                  <section key={group} aria-labelledby={`kbd-group-${group}`}>
                    <h3
                      id={`kbd-group-${group}`}
                      className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1"
                    >
                      {group}
                    </h3>

                    <table
                      className="w-full text-sm border-separate"
                      style={{ borderSpacing: "0 3px" }}
                      aria-label={`${group} keyboard shortcuts`}
                    >
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="group">
                            <td className="pl-3 pr-4 py-2 rounded-l-lg bg-gray-800/50 group-hover:bg-gray-800 transition-colors w-40">
                              <span className="flex items-center gap-1 flex-wrap">
                                {entry.keys.map((k, i) => (
                                  <span key={`${k}-${i}`} className="flex items-center gap-1">
                                    {i > 0 && (
                                      <span className="text-[10px] text-gray-600 mx-0.5">then</span>
                                    )}
                                    <KbdKey label={k} />
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td className="pr-3 py-2 rounded-r-lg bg-gray-800/50 group-hover:bg-gray-800 transition-colors text-gray-300 text-sm">
                              {entry.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}

            {/* Footer hint */}
            <p className="mt-5 text-xs text-gray-500 text-center">
              Shortcuts are disabled while typing in text fields.{" "}
              <kbd className="rounded bg-gray-700 border border-gray-600 px-1 py-0.5 text-[10px] font-mono text-gray-300">
                Esc
              </kbd>{" "}
              to close.
            </p>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
