"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import { getTransitionDirection, prefersReducedMotion, supportsViewTransitions } from "@/lib/transitions";

/**
 * Wraps route content and animates enter/exit with the View Transitions API
 * when the pathname changes. Soft navigations (modals, filters) don't touch
 * the pathname, so they never trigger a transition. Falls back to an instant
 * swap when the API is unsupported or the user prefers reduced motion.
 */
export default function TransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [displayed, setDisplayed] = useState(children);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      // Same route — just keep the latest children (e.g. server data refresh).
      setDisplayed(children);
      return;
    }

    const fromPathname = previousPathname.current;
    previousPathname.current = pathname;

    if (!supportsViewTransitions() || prefersReducedMotion()) {
      setDisplayed(children);
      return;
    }

    document.documentElement.setAttribute(
      "data-transition-direction",
      getTransitionDirection(fromPathname, pathname)
    );

    document.startViewTransition(() => {
      flushSync(() => setDisplayed(children));
    });
  }, [pathname, children]);

  return <>{displayed}</>;
}
