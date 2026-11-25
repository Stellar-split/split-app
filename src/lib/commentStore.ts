/**
 * Server-side registry of invoice comments and emoji reactions, with a
 * pub/sub layer the SSE route uses to push live updates. Like
 * pushSubscriptionStore, this lives in memory for the process lifetime —
 * there's no database in this project.
 */
import { EventEmitter } from "events";

export const ALLOWED_EMOJIS = ["👍", "❤️", "✅", "❓"] as const;
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];

export interface StoredComment {
  id: string;
  invoiceId: string;
  authorAddress: string;
  text: string;
  createdAt: number;
}

export type CommentEvent =
  | { type: "comment-added"; comment: StoredComment }
  | { type: "comment-deleted"; commentId: string }
  | { type: "reaction-updated"; commentId: string; counts: Record<string, number> };

const commentsByInvoice = new Map<string, StoredComment[]>();
const reactionsByComment = new Map<string, Map<AllowedEmoji, Set<string>>>();
const emittersByInvoice = new Map<string, EventEmitter>();

function getEmitter(invoiceId: string): EventEmitter {
  let emitter = emittersByInvoice.get(invoiceId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    emittersByInvoice.set(invoiceId, emitter);
  }
  return emitter;
}

function publish(invoiceId: string, event: CommentEvent): void {
  getEmitter(invoiceId).emit("event", event);
}

/** Subscribe to live comment/reaction events for an invoice. Returns an unsubscribe function. */
export function subscribe(invoiceId: string, listener: (event: CommentEvent) => void): () => void {
  const emitter = getEmitter(invoiceId);
  emitter.on("event", listener);
  return () => {
    emitter.off("event", listener);
  };
}

export function isAllowedEmoji(value: string): value is AllowedEmoji {
  return (ALLOWED_EMOJIS as readonly string[]).includes(value);
}

function generateCommentId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addComment(invoiceId: string, authorAddress: string, text: string): StoredComment {
  const comment: StoredComment = {
    id: generateCommentId(),
    invoiceId,
    authorAddress,
    text,
    createdAt: Date.now(),
  };
  const list = commentsByInvoice.get(invoiceId) ?? [];
  list.push(comment);
  commentsByInvoice.set(invoiceId, list);
  publish(invoiceId, { type: "comment-added", comment });
  return comment;
}

export const DEFAULT_COMMENT_PAGE_SIZE = 50;
export const MAX_COMMENT_PAGE_SIZE = 200;

/**
 * Oldest-first page of comments, ordered by `createdAt` (ties broken by id).
 * Pass `before` (a createdAt cursor) to page further back: only comments
 * strictly older than the cursor are returned, and the newest `limit` of those
 * are kept so pages walk backwards without gaps or duplicates.
 */
export function listComments(
  invoiceId: string,
  opts: { before?: number; limit?: number } = {}
): StoredComment[] {
  const all = commentsByInvoice.get(invoiceId) ?? [];
  const requested = opts.limit ?? DEFAULT_COMMENT_PAGE_SIZE;
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), 1), MAX_COMMENT_PAGE_SIZE)
    : DEFAULT_COMMENT_PAGE_SIZE;

  const ordered = [...all].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
  );
  const filtered =
    opts.before !== undefined && Number.isFinite(opts.before)
      ? ordered.filter((c) => c.createdAt < opts.before!)
      : ordered;

  return filtered.slice(-limit);
}

export function getComment(invoiceId: string, commentId: string): StoredComment | undefined {
  return commentsByInvoice.get(invoiceId)?.find((c) => c.id === commentId);
}

export function deleteComment(invoiceId: string, commentId: string): boolean {
  const list = commentsByInvoice.get(invoiceId);
  if (!list) return false;
  const idx = list.findIndex((c) => c.id === commentId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  reactionsByComment.delete(commentId);
  publish(invoiceId, { type: "comment-deleted", commentId });
  return true;
}

export function reactionCounts(commentId: string): Record<AllowedEmoji, number> {
  const map = reactionsByComment.get(commentId);
  const counts = {} as Record<AllowedEmoji, number>;
  for (const emoji of ALLOWED_EMOJIS) {
    counts[emoji] = map?.get(emoji)?.size ?? 0;
  }
  return counts;
}

export function reactorEmojis(commentId: string, reactorId: string): AllowedEmoji[] {
  const map = reactionsByComment.get(commentId);
  if (!map) return [];
  return ALLOWED_EMOJIS.filter((emoji) => map.get(emoji)?.has(reactorId));
}

/**
 * Toggle a reactor's reaction for a comment: adds it if absent, removes it
 * if already present. Returns the updated counts and whether the reactor is
 * now active for that emoji.
 */
export function toggleReaction(
  invoiceId: string,
  commentId: string,
  emoji: AllowedEmoji,
  reactorId: string
): { counts: Record<AllowedEmoji, number>; active: boolean } {
  let map = reactionsByComment.get(commentId);
  if (!map) {
    map = new Map();
    reactionsByComment.set(commentId, map);
  }
  let reactors = map.get(emoji);
  if (!reactors) {
    reactors = new Set();
    map.set(emoji, reactors);
  }

  let active: boolean;
  if (reactors.has(reactorId)) {
    reactors.delete(reactorId);
    active = false;
  } else {
    reactors.add(reactorId);
    active = true;
  }

  const counts = reactionCounts(commentId);
  publish(invoiceId, { type: "reaction-updated", commentId, counts });
  return { counts, active };
}

/** Test-only: reset all in-memory state between test cases. */
export function __resetCommentStoreForTests(): void {
  commentsByInvoice.clear();
  reactionsByComment.clear();
  for (const emitter of emittersByInvoice.values()) {
    emitter.removeAllListeners();
  }
  emittersByInvoice.clear();
}
