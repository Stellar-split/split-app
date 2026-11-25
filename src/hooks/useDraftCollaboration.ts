"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  colorForCollaborator,
  DraftActivityEvent,
  DraftComment,
  DraftCollaborationChannel,
  FieldLock,
  LOCK_TTL,
  PRESENCE_TTL,
  pruneStale,
  type Collaborator,
} from "@/lib/draftCollaboration";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Real-time collaboration for a single invoice draft: presence,
 * field-level locking, an activity feed and inline comments, synced
 * across tabs/windows via BroadcastChannel + localStorage.
 */
export function useDraftCollaboration(draftId: string, displayName?: string) {
  const selfId = useRef(randomId());
  const selfName = displayName?.trim() || `Guest ${selfId.current.slice(0, 4)}`;

  const channel = useMemo(() => new DraftCollaborationChannel(draftId), [draftId]);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activity, setActivity] = useState<DraftActivityEvent[]>(() => channel.getState().activity);
  const [comments, setComments] = useState<DraftComment[]>(() => channel.getState().comments);
  const [locks, setLocks] = useState<Record<string, FieldLock>>(() => channel.getState().locks);

  useEffect(() => {
    const self: Collaborator = {
      id: selfId.current,
      name: selfName,
      color: colorForCollaborator(selfId.current),
      lastSeen: Date.now(),
    };
    setCollaborators([self]);
    channel.send({ type: "presence", collaborator: self });

    const heartbeat = setInterval(() => {
      channel.send({
        type: "presence",
        collaborator: { ...self, lastSeen: Date.now() },
      });
      setCollaborators((prev) => pruneStale(prev, PRESENCE_TTL));
      setLocks((prev) => {
        const next: Record<string, FieldLock> = {};
        for (const [field, lock] of Object.entries(prev)) {
          if (Date.now() - lock.acquiredAt < LOCK_TTL) next[field] = lock;
        }
        return next;
      });
    }, 5000);

    const unsubscribe = channel.subscribe((msg) => {
      if (msg.type === "presence") {
        setCollaborators((prev) => {
          const others = prev.filter((c) => c.id !== msg.collaborator.id);
          return [...others, msg.collaborator];
        });
      } else if (msg.type === "leave") {
        setCollaborators((prev) => prev.filter((c) => c.id !== msg.collaboratorId));
      } else if (msg.type === "activity") {
        setActivity((prev) => {
          const next = [...prev, msg.event].slice(-50);
          channel.setState((s) => ({ ...s, activity: next }));
          return next;
        });
      } else if (msg.type === "comment") {
        setComments((prev) => {
          const next = [...prev, msg.comment];
          channel.setState((s) => ({ ...s, comments: next }));
          return next;
        });
      } else if (msg.type === "lock") {
        setLocks((prev) => {
          const next = { ...prev, [msg.lock.field]: msg.lock };
          channel.setState((s) => ({ ...s, locks: next }));
          return next;
        });
      } else if (msg.type === "unlock") {
        setLocks((prev) => {
          const next = { ...prev };
          if (next[msg.field]?.collaboratorId === msg.collaboratorId) delete next[msg.field];
          channel.setState((s) => ({ ...s, locks: next }));
          return next;
        });
      }
    });

    const handleUnload = () => channel.send({ type: "leave", collaboratorId: selfId.current });
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeat);
      unsubscribe();
      handleUnload();
      window.removeEventListener("beforeunload", handleUnload);
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const postActivity = useCallback(
    (message: string) => {
      const event: DraftActivityEvent = {
        id: randomId(),
        collaboratorId: selfId.current,
        collaboratorName: selfName,
        message,
        timestamp: Date.now(),
      };
      channel.send({ type: "activity", event });
    },
    [channel, selfName]
  );

  const postComment = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const comment: DraftComment = {
        id: randomId(),
        collaboratorId: selfId.current,
        collaboratorName: selfName,
        text: text.trim(),
        timestamp: Date.now(),
      };
      channel.send({ type: "comment", comment });
    },
    [channel, selfName]
  );

  /** Attempt to acquire an editing lock on a field. Returns whether it was granted to this collaborator. */
  const acquireLock = useCallback(
    (field: string) => {
      const existing = locks[field];
      if (existing && existing.collaboratorId !== selfId.current && Date.now() - existing.acquiredAt < LOCK_TTL) {
        return false;
      }
      const lock: FieldLock = {
        field,
        collaboratorId: selfId.current,
        collaboratorName: selfName,
        acquiredAt: Date.now(),
      };
      channel.send({ type: "lock", lock });
      return true;
    },
    [channel, locks, selfName]
  );

  const releaseLock = useCallback(
    (field: string) => {
      channel.send({ type: "unlock", field, collaboratorId: selfId.current });
    },
    [channel]
  );

  /** Resolves a conflict by keeping the most recently edited value and logging it to the activity feed. */
  const resolveConflict = useCallback(
    <T,>(field: string, localValue: T, localTimestamp: number, remoteValue: T, remoteTimestamp: number): T => {
      const winner = remoteTimestamp >= localTimestamp ? remoteValue : localValue;
      postActivity(
        `Resolved conflicting edits on "${field}" — kept the ${
          remoteTimestamp >= localTimestamp ? "most recent remote" : "local"
        } change`
      );
      return winner;
    },
    [postActivity]
  );

  return {
    selfId: selfId.current,
    collaborators: pruneStale(collaborators, PRESENCE_TTL),
    activity,
    comments,
    locks,
    postActivity,
    postComment,
    acquireLock,
    releaseLock,
    resolveConflict,
    isLockedByOther: (field: string) => {
      const lock = locks[field];
      return !!lock && lock.collaboratorId !== selfId.current && Date.now() - lock.acquiredAt < LOCK_TTL;
    },
  };
}
