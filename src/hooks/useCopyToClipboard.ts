'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const RESET_DELAY_MS = 2000;

/**
 * Copies text to the clipboard and exposes a transient `copied` flag.
 * `copied` becomes true on success and resets to false after 2 seconds.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearResetTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (typeof document !== 'undefined') {
          // fallback for browsers without Clipboard API
          const el = document.createElement('textarea');
          el.value = text;
          el.setAttribute('readonly', '');
          el.style.position = 'fixed';
          el.style.opacity = '0';
          document.body.appendChild(el);
          el.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(el);
          if (!ok) return false;
        } else {
          return false;
        }

        if (!mountedRef.current) return true;

        setCopied(true);
        clearResetTimeout();
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          if (mountedRef.current) setCopied(false);
        }, RESET_DELAY_MS);
        return true;
      } catch {
        // silently fail — caller can handle
        return false;
      }
    },
    [clearResetTimeout]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearResetTimeout();
    };
  }, [clearResetTimeout]);

  return { copy, copied };
}
