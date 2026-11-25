"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDraft, getDraft, putDraft, type DraftFormData, type StoredDraft } from "@/lib/offlineDraftDB";
import { apiFetch } from "@/lib/apiClient";

const AUTOSAVE_INTERVAL_MS = 5_000;

export interface UseOfflineDraftAutosaveResult {
  isOffline: boolean;
  lastSavedAt: number | null;
  /** Delete the local draft immediately, e.g. after a successful submit. */
  discardDraft: () => Promise<void>;
}

/**
 * Autosaves invoice form state to IndexedDB every 5 seconds and flushes it
 * to the server once the browser is back online, so a dropped connection
 * (or a closed tab) never loses in-progress work.
 */
export function useOfflineDraftAutosave(
  userId: string,
  draftId: string,
  data: DraftFormData,
  onConflict?: (local: StoredDraft, server: { updatedAt: number }) => void
): UseOfflineDraftAutosaveResult {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;

  const flush = useCallback(async () => {
    if (!userId || !draftId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const draft = await getDraft(userId, draftId);
    if (!draft) return;

    try {
      const serverRes = await apiFetch(
        `/api/invoices/drafts?${new URLSearchParams({ userId, draftId })}`
      );
      if (serverRes.ok) {
        const serverBody = await serverRes.json().catch(() => null);
        const serverUpdatedAt = serverBody?.updatedAt;
        if (typeof serverUpdatedAt === "number" && serverUpdatedAt > draft.updatedAt) {
          onConflictRef.current?.(draft, { updatedAt: serverUpdatedAt });
          return;
        }
      }
    } catch {
      // Can't reach the server to check for a conflict — fall through and sync as before.
    }

    try {
      const res = await apiFetch("/api/invoices/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, userId, data: draft.data }),
      });
      if (res.ok) {
        await deleteDraft(userId, draftId);
      }
    } catch {
      // Offline or the request failed — keep it queued locally and retry
      // on the next reconnect or autosave tick.
    }
  }, [userId, draftId]);

  useEffect(() => {
    if (!userId || !draftId) return;
    const interval = setInterval(() => {
      putDraft(userId, draftId, dataRef.current).then(() => setLastSavedAt(Date.now()));
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, draftId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      flush();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (typeof navigator !== "undefined" && navigator.onLine) flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  const discardDraft = useCallback(async () => {
    if (!userId || !draftId) return;
    await deleteDraft(userId, draftId);
  }, [userId, draftId]);

  return { isOffline, lastSavedAt, discardDraft };
}
