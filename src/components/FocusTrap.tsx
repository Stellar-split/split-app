"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClose?: () => void;
  /** When false, children are rendered but focus is not trapped. Default: true. */
  active?: boolean;
  className?: string;
};

export default function FocusTrap({ children, onClose, active = true, className = "outline-none" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const prev = document.activeElement as HTMLElement | null;

    const getTabbables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));

    const tabbables = getTabbables();

    if (tabbables.length > 0) {
      // focus the first tabbable element
      tabbables[0].focus();
    } else {
      // otherwise focus the container for keyboard users
      container.tabIndex = -1;
      container.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key !== "Tab") return;

      const nodes = getTabbables();
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const focused = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (focused === first || focused === container) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (focused === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      try {
        prev?.focus();
      } catch {}
    };
  }, [onClose, active]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
