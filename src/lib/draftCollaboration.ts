"use client";

/**
 * Lightweight real-time collaboration layer for invoice drafts.
 *
 * Uses the browser BroadcastChannel API to sync presence, field-level
 * locks, activity events and comments across every tab/window editing
 * the same draft, with localStorage as the source of truth so late
 * joiners (or a page refresh) still see current state. This avoids
 * needing a dedicated realtime backend while still giving genuine
 * live multi-tab/multi-user (same browser profile / shared machine)
 * collaboration semantics.
 */

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export interface DraftActivityEvent {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  message: string;
  timestamp: number;
}

export interface DraftComment {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  text: string;
  timestamp: number;
}

export interface FieldLock {
  field: string;
  collaboratorId: string;
  collaboratorName: string;
  acquiredAt: number;
}

interface DraftCollabState {
  activity: DraftActivityEvent[];
  comments: DraftComment[];
  locks: Record<string, FieldLock>;
}

type Message =
  | { type: "presence"; collaborator: Collaborator }
  | { type: "leave"; collaboratorId: string }
  | { type: "activity"; event: DraftActivityEvent }
  | { type: "comment"; comment: DraftComment }
  | { type: "lock"; lock: FieldLock }
  | { type: "unlock"; field: string; collaboratorId: string }
  | { type: "field-change"; field: string; value: unknown; collaboratorId: string };

const LOCK_TTL_MS = 30_000;
const PRESENCE_TTL_MS = 15_000;

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

function storageKey(draftId: string) {
  return `draft-collab:${draftId}`;
}

function loadState(draftId: string): DraftCollabState {
  if (typeof window === "undefined") return { activity: [], comments: [], locks: {} };
  try {
    const raw = window.localStorage.getItem(storageKey(draftId));
    if (!raw) return { activity: [], comments: [], locks: {} };
    const parsed = JSON.parse(raw) as DraftCollabState;
    return {
      activity: parsed.activity ?? [],
      comments: parsed.comments ?? [],
      locks: parsed.locks ?? {},
    };
  } catch {
    return { activity: [], comments: [], locks: {} };
  }
}

function saveState(draftId: string, state: DraftCollabState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(draftId), JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota); collaboration
    // degrades gracefully to in-memory only for this tab.
  }
}

export function colorForCollaborator(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function pruneStale<T extends { lastSeen?: number; acquiredAt?: number }>(
  items: T[],
  ttl: number
): T[] {
  const now = Date.now();
  return items.filter((item) => {
    const ts = item.lastSeen ?? item.acquiredAt ?? now;
    return now - ts < ttl;
  });
}

export class DraftCollaborationChannel {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(msg: Message) => void>();
  readonly draftId: string;

  constructor(draftId: string) {
    this.draftId = draftId;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(`draft-collab:${draftId}`);
      this.channel.onmessage = (ev: MessageEvent<Message>) => {
        this.listeners.forEach((listener) => listener(ev.data));
      };
    }
  }

  subscribe(listener: (msg: Message) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(msg: Message) {
    this.channel?.postMessage(msg);
    // Deliver to self synchronously since BroadcastChannel does not
    // echo back to the sending context.
    this.listeners.forEach((listener) => listener(msg));
  }

  close() {
    this.channel?.close();
    this.listeners.clear();
  }

  getState(): DraftCollabState {
    return loadState(this.draftId);
  }

  setState(mutator: (state: DraftCollabState) => DraftCollabState) {
    const next = mutator(loadState(this.draftId));
    saveState(this.draftId, next);
    return next;
  }
}

export const PRESENCE_TTL = PRESENCE_TTL_MS;
export const LOCK_TTL = LOCK_TTL_MS;
export type { Message as DraftCollabMessage };
