'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface UnsavedChangesState {
  isDirty: boolean;
  setPending: (href: string) => void;
  confirm: () => void;
  cancel: () => void;
  pendingNavigation: string | null;
}

export function useUnsavedChanges(isDirty: boolean): UnsavedChangesState {
  const router = useRouter();
  const pendingNavRef = useRef<string | null>(null);
  const unloadListenerAttached = useRef(false);

  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    },
    [isDirty]
  );

  useEffect(() => {
    if (isDirty && !unloadListenerAttached.current) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      unloadListenerAttached.current = true;
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        unloadListenerAttached.current = false;
      };
    } else if (!isDirty && unloadListenerAttached.current) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unloadListenerAttached.current = false;
    }
  }, [isDirty, handleBeforeUnload]);

  const setPending = useCallback((href: string) => {
    pendingNavRef.current = href;
  }, []);

  const confirm = useCallback(() => {
    if (pendingNavRef.current) {
      router.push(pendingNavRef.current);
      pendingNavRef.current = null;
    }
  }, [router]);

  const cancel = useCallback(() => {
    pendingNavRef.current = null;
  }, []);

  return {
    isDirty,
    setPending,
    confirm,
    cancel,
    pendingNavigation: pendingNavRef.current,
  };
}
