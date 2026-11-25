"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShortcutModifier = "meta" | "ctrl" | "alt" | "shift";

export interface ShortcutDefinition {
  /** Unique identifier for this shortcut (used as React key and for deregistration) */
  id: string;
  /** Display label(s) shown in the help overlay, e.g. ["?"] or ["G", "D"] */
  keys: string[];
  /** Human-readable description shown in the help overlay */
  description: string;
  /**
   * Optional grouping for the help overlay (e.g. "Navigation", "Invoices").
   * Defaults to "General".
   */
  group?: string;
  /**
   * The handler to invoke when the shortcut fires.
   * Return `false` to prevent default browser behaviour.
   */
  handler: (e: KeyboardEvent) => void | false;
  /** Set to false to temporarily disable without unregistering. Defaults to true. */
  enabled?: boolean;
}

export interface ShortcutRegistryContextValue {
  /** Register one or more shortcuts. Existing id is replaced. */
  register: (shortcut: ShortcutDefinition | ShortcutDefinition[]) => void;
  /** Unregister by id. */
  unregister: (id: string | string[]) => void;
  /** All currently registered shortcuts (stable reference). */
  shortcuts: ShortcutDefinition[];
}

// ── Context ───────────────────────────────────────────────────────────────────

const ShortcutRegistryContext =
  createContext<ShortcutRegistryContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * ShortcutRegistryProvider
 *
 * Mount this once near the root of the application (inside the layout).
 * Child components call `useRegisterShortcuts` to add their shortcuts.
 * The global keydown listener lives here so it's always active.
 */
export function ShortcutRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>([]);
  // Keep a ref so the keydown handler always sees the latest list
  // without needing to be recreated on every state change.
  const shortcutsRef = useRef<ShortcutDefinition[]>([]);

  const register = useCallback(
    (input: ShortcutDefinition | ShortcutDefinition[]) => {
      const incoming = Array.isArray(input) ? input : [input];
      setShortcuts((prev) => {
        const ids = new Set(incoming.map((s) => s.id));
        const filtered = prev.filter((s) => !ids.has(s.id));
        const next = [...filtered, ...incoming];
        shortcutsRef.current = next;
        return next;
      });
    },
    [],
  );

  const unregister = useCallback((ids: string | string[]) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setShortcuts((prev) => {
      const next = prev.filter((s) => !set.has(s.id));
      shortcutsRef.current = next;
      return next;
    });
  }, []);

  // Global keydown listener — delegates to registered handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore shortcuts while the user is typing
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Allow Escape even inside editable elements (to close modals)
      if (isEditable && e.key !== "Escape") return;

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;
        const result = shortcut.handler(e);
        if (result === false) {
          e.preventDefault();
        }
        // First matching handler wins — break out
        if (e.defaultPrevented) break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo<ShortcutRegistryContextValue>(
    () => ({ register, unregister, shortcuts }),
    [register, unregister, shortcuts],
  );

  return (
    <ShortcutRegistryContext.Provider value={value}>
      {children}
    </ShortcutRegistryContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Access the raw registry context. Used internally.
 */
export function useShortcutRegistry(): ShortcutRegistryContextValue {
  const ctx = useContext(ShortcutRegistryContext);
  if (!ctx) {
    // Graceful degradation outside provider
    return {
      register: () => {},
      unregister: () => {},
      shortcuts: [],
    };
  }
  return ctx;
}

/**
 * useRegisterShortcuts
 *
 * Register a static list of shortcuts for the lifetime of the calling component.
 * Shortcuts are automatically unregistered on unmount.
 *
 * @example
 * useRegisterShortcuts([
 *   {
 *     id: "dashboard:new-invoice",
 *     keys: ["N"],
 *     description: "Create new invoice",
 *     group: "Dashboard",
 *     handler: () => router.push("/invoice/new"),
 *   },
 * ]);
 */
export function useRegisterShortcuts(
  shortcuts: ShortcutDefinition[],
  deps: React.DependencyList = [],
) {
  const { register, unregister } = useShortcutRegistry();
  const ids = shortcuts.map((s) => s.id);

  useEffect(() => {
    register(shortcuts);
    return () => unregister(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
