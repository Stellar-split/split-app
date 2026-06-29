"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Manages global keyboard shortcut state.
 *
 * Shortcuts:
 * - `?` opens the keyboard shortcuts reference modal
 * - `Cmd/Ctrl + K` opens the command palette
 * - `N` on dashboard opens the Create Invoice form
 * - `Esc` closes any open modal or panel
 * - `G` then `D` navigates to Dashboard
 * - `G` then `S` navigates to Search
 * - `G` then `L` navigates to Leaderboard
 */
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const router = useRouter();

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

      // Esc closes modal or clears g-state
      if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        if (gPressed) {
          e.preventDefault();
          setGPressed(false);
        }
        return;
      }

      // ? opens keyboard shortcuts
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // G-key navigation (G then D/S/L)
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setGPressed(true);
        // Reset after 2 seconds of inactivity
        const timer = setTimeout(() => setGPressed(false), 2000);
        return;
      }

      // G navigation shortcuts
      if (gPressed && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "d") {
          e.preventDefault();
          setGPressed(false);
          router.push("/dashboard");
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          setGPressed(false);
          router.push("/search");
          return;
        }
        if (e.key === "l") {
          e.preventDefault();
          setGPressed(false);
          router.push("/leaderboard");
          return;
        }
        // Invalid G-key combo, reset
        if (!/[dsl]/.test(e.key)) {
          setGPressed(false);
        }
        return;
      }

      // N opens Create Invoice form on dashboard
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        // Only trigger if on dashboard
        if (window.location.pathname === "/dashboard") {
          e.preventDefault();
          // Dispatch custom event for DashboardClient to listen to
          window.dispatchEvent(
            new CustomEvent("keyboard:create-invoice")
          );
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, gPressed, router]);

  return { isOpen, open, close };
}
