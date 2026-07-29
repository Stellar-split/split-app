"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRegisterShortcuts, useShortcutRegistry } from "@/context/ShortcutRegistry";

/**
 * useKeyboardShortcuts
 *
 * Registers all global application shortcuts into the ShortcutRegistry and
 * exposes the help-overlay open/close state.
 *
 * This hook should be mounted once — inside HeaderShortcutsButton which is
 * rendered in the Navbar (present on every page).
 *
 * Shortcuts registered here:
 * - `?`           — Open/close the keyboard shortcuts help overlay
 * - `Esc`         — Close the help overlay
 * - `N`           — Create new invoice (only on /dashboard)
 * - `G` then `D`  — Navigate to Dashboard
 * - `G` then `S`  — Navigate to Search
 * - `G` then `L`  — Navigate to Leaderboard
 */
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // g-key chord state tracked via ref to avoid re-creating handlers on change
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const resetGTimer = useCallback(() => {
    if (gTimerRef.current) clearTimeout(gTimerRef.current);
    gTimerRef.current = setTimeout(() => {
      gPressedRef.current = false;
    }, 2000);
  }, []);

  useRegisterShortcuts(
    [
      // ── Help overlay ───────────────────────────────────────────────────────
      {
        id: "global:help",
        keys: ["?"],
        description: "Open keyboard shortcuts reference",
        group: "General",
        handler: (e) => {
          if (e.key !== "?") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          setIsOpen((prev) => !prev);
        },
      },

      // ── Close overlay ──────────────────────────────────────────────────────
      {
        id: "global:escape",
        keys: ["Esc"],
        description: "Close modal / dismiss overlay",
        group: "General",
        handler: (e) => {
          if (e.key !== "Escape") return;
          if (isOpenRef.current) {
            e.preventDefault();
            setIsOpen(false);
          }
          if (gPressedRef.current) {
            e.preventDefault();
            gPressedRef.current = false;
            if (gTimerRef.current) clearTimeout(gTimerRef.current);
          }
        },
      },

      // ── Create invoice ─────────────────────────────────────────────────────
      {
        id: "dashboard:new-invoice",
        keys: ["N"],
        description: "Create new invoice (on dashboard)",
        group: "Invoices",
        handler: (e) => {
          if (e.key !== "n") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          if (window.location.pathname !== "/dashboard") return;
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("keyboard:create-invoice"));
        },
      },

      // ── G-chord: activate ──────────────────────────────────────────────────
      {
        id: "global:g-chord",
        keys: ["G"],
        description: "Start navigation chord (G then D/S/L)",
        group: "Navigation",
        handler: (e) => {
          if (e.key !== "g") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          if (gPressedRef.current) return; // already in chord
          e.preventDefault();
          gPressedRef.current = true;
          resetGTimer();
        },
      },

      // ── G + D: dashboard ───────────────────────────────────────────────────
      {
        id: "nav:dashboard",
        keys: ["G", "D"],
        description: "Navigate to Dashboard",
        group: "Navigation",
        handler: (e) => {
          if (!gPressedRef.current) return;
          if (e.key !== "d") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          router.push("/dashboard");
        },
      },

      // ── G + S: search ──────────────────────────────────────────────────────
      {
        id: "nav:search",
        keys: ["G", "S"],
        description: "Navigate to Search",
        group: "Navigation",
        handler: (e) => {
          if (!gPressedRef.current) return;
          if (e.key !== "s") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          router.push("/search");
        },
      },

      // ── G + L: leaderboard ─────────────────────────────────────────────────
      {
        id: "nav:leaderboard",
        keys: ["G", "L"],
        description: "Navigate to Leaderboard",
        group: "Navigation",
        handler: (e) => {
          if (!gPressedRef.current) return;
          if (e.key !== "l") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          router.push("/leaderboard");
        },
      },

      // ── G + N: new invoice (global, not just dashboard) ────────────────────
      {
        id: "nav:new-invoice",
        keys: ["G", "N"],
        description: "Go to New Invoice",
        group: "Navigation",
        handler: (e) => {
          if (!gPressedRef.current) return;
          if (e.key !== "n") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          router.push("/invoice/new");
        },
      },
    ],
    // Stable deps — router reference is stable in Next.js App Router
    [],
  );

  return { isOpen, open, close };
}
