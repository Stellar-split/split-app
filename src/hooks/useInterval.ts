"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` on every `delay` ms tick.
 * Pass `null` as delay to pause the interval.
 * Callback ref is kept fresh so callers don't need to memoize it.
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
