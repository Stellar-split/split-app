"use client";

import { useEffect, useRef, useState } from "react";
import { parseMentions, notifyMention } from "@/lib/notifications";
import RelativeTime from "@/components/ui/RelativeTime";
import { ALLOWED_EMOJIS, type AllowedEmoji } from "@/lib/commentStore";

interface Comment {
  id: string;
  invoiceId: string;
  walletAddress: string;
  text: string;
  timestamp: number;
}

/** Per-comment reaction state stored in localStorage. */
interface ReactionState {
  /** Aggregate counts: emoji → count */
  counts: Record<string, number>;
  /** Emojis this user has actively reacted with */
  myReactions: AllowedEmoji[];
}

interface Props {
  invoiceId: string;
  walletAddress: string;
}

const STORAGE_KEY = "stellarsplit_comments";
const REACTIONS_STORAGE_KEY = "stellarsplit_reactions";

function loadComments(invoiceId: string, walletAddress: string): Comment[] {
  if (typeof window === "undefined") return [];
  try {
    const all: Comment[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return all.filter(
      (c) => c.invoiceId === invoiceId && c.walletAddress === walletAddress
    );
  } catch {
    return [];
  }
}

function saveComment(comment: Comment) {
  const all: Comment[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]"
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, comment]));
}

function deleteComment(id: string) {
  const all: Comment[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]"
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(all.filter((c) => c.id !== id))
  );
}

function loadReactionsMap(): Record<string, ReactionState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REACTIONS_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveReactionsMap(map: Record<string, ReactionState>) {
  localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(map));
}

/** Stellar address pattern — must match parseMentions regex. */
const MENTION_SPLIT_RE = /(\bG[A-Z0-9]{55}\b)/g;
const MENTION_TEST_RE  = /^G[A-Z0-9]{55}$/;

/**
 * Render comment text with @G... addresses as styled chips.
 * Anything that doesn't match the pattern renders as plain text.
 */
export function renderCommentText(text: string): React.ReactNode[] {
  const parts = text.split(MENTION_SPLIT_RE);
  return parts.map((part, i) =>
    MENTION_TEST_RE.test(part) ? (
      <span
        key={i}
        className="inline-flex items-center rounded-full bg-indigo-900/60 text-indigo-300 text-xs font-mono px-2 py-0.5 mx-0.5"
        aria-label={`Mentioned address ${part}`}
      >
        @{part.slice(0, 6)}…{part.slice(-4)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** Compact emoji picker that appears when the "+" button is clicked. */
function EmojiPicker({
  commentId,
  myReactions,
  onToggle,
  onClose,
}: {
  commentId: string;
  myReactions: AllowedEmoji[];
  onToggle: (emoji: AllowedEmoji) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick a reaction"
      className="absolute z-50 bottom-full mb-1 left-0 flex gap-1 bg-gray-800 border border-gray-700 rounded-xl px-2 py-1.5 shadow-lg"
    >
      {ALLOWED_EMOJIS.map((emoji) => {
        const isActive = myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={isActive}
            aria-label={`React with ${emoji}`}
            onClick={() => {
              onToggle(emoji);
              onClose();
            }}
            className={`text-lg rounded-lg w-9 h-9 flex items-center justify-center transition-colors ${
              isActive
                ? "bg-indigo-600/40 ring-1 ring-indigo-500"
                : "hover:bg-gray-700"
            }`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

/**
 * CommentSection — off-chain per-invoice notes stored in localStorage.
 * Only shows comments belonging to the connected wallet address.
 * Supports @G... mention chips, browser notifications, and emoji reactions.
 *
 * Reactions are persisted locally and also synced to the server via
 * POST /api/invoices/[id]/comments/[commentId]/reactions when available.
 */
export default function CommentSection({ invoiceId, walletAddress }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionState>>({});
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComments(loadComments(invoiceId, walletAddress));
    setReactionsMap(loadReactionsMap());
  }, [invoiceId, walletAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      invoiceId,
      walletAddress,
      text: trimmed,
      timestamp: Date.now(),
    };
    saveComment(comment);
    setComments((prev) => [...prev, comment]);

    // Fire notifications for each unique mentioned address (skip self).
    for (const addr of parseMentions(trimmed)) {
      notifyMention(addr, walletAddress, invoiceId);
    }

    setText("");
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    deleteComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  /**
   * Toggle an emoji reaction for a comment.
   * Updates local state + localStorage, and attempts to sync to the server.
   */
  const handleToggleReaction = async (commentId: string, emoji: AllowedEmoji) => {
    const current = reactionsMap[commentId] ?? { counts: {}, myReactions: [] };
    const isActive = current.myReactions.includes(emoji);

    // Optimistic local update
    const newMyReactions: AllowedEmoji[] = isActive
      ? current.myReactions.filter((e) => e !== emoji)
      : [...current.myReactions, emoji];

    const newCounts = { ...current.counts };
    const prevCount = newCounts[emoji] ?? 0;
    newCounts[emoji] = isActive ? Math.max(0, prevCount - 1) : prevCount + 1;

    const updated: ReactionState = { counts: newCounts, myReactions: newMyReactions };
    const newMap = { ...reactionsMap, [commentId]: updated };

    setReactionsMap(newMap);
    saveReactionsMap(newMap);

    // Best-effort server sync (fire-and-forget; server is source of truth for
    // multi-user scenarios but localStorage keeps single-user UX snappy).
    try {
      const res = await fetch(
        `/api/invoices/${invoiceId}/comments/${commentId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji, reactorId: walletAddress }),
        }
      );
      if (res.ok) {
        const data: { counts: Record<string, number>; active: boolean } = await res.json();
        // Reconcile server counts
        const reconciled: ReactionState = {
          counts: data.counts as Record<string, number>,
          myReactions: data.active
            ? [...new Set([...newMyReactions, emoji])]
            : newMyReactions.filter((e) => e !== emoji),
        };
        const reconciledMap = { ...newMap, [commentId]: reconciled };
        setReactionsMap(reconciledMap);
        saveReactionsMap(reconciledMap);
      }
    } catch {
      // Network unavailable — local state is already updated, which is fine.
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Notes</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {comments.map((c) => {
            const reactionState = reactionsMap[c.id] ?? { counts: {}, myReactions: [] };
            const hasReactions = Object.values(reactionState.counts).some((n) => n > 0);

            return (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 bg-gray-900 rounded-lg px-4 py-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 break-words">{renderCommentText(c.text)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <RelativeTime iso={new Date(c.timestamp).toISOString()} />
                  </p>

                  {/* Reaction chips */}
                  {hasReactions && (
                    <div
                      className="flex items-center gap-1 flex-wrap mt-2"
                      role="group"
                      aria-label="Reactions"
                    >
                      {ALLOWED_EMOJIS.map((emoji) => {
                        const count = reactionState.counts[emoji] ?? 0;
                        if (count === 0) return null;
                        const isActive = reactionState.myReactions.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            aria-pressed={isActive}
                            aria-label={`${emoji} reaction (${count}). Click to ${isActive ? "remove" : "add"}`}
                            onClick={() => handleToggleReaction(c.id, emoji)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                              isActive
                                ? "bg-indigo-600/30 text-indigo-200 border-indigo-500"
                                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                            }`}
                          >
                            <span aria-hidden="true">{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Add reaction row */}
                  <div className="relative mt-2 inline-block">
                    <button
                      type="button"
                      aria-label="Add reaction"
                      aria-haspopup="dialog"
                      aria-expanded={openPickerFor === c.id}
                      onClick={() =>
                        setOpenPickerFor((prev) => (prev === c.id ? null : c.id))
                      }
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors text-sm"
                    >
                      +
                    </button>
                    {openPickerFor === c.id && (
                      <EmojiPicker
                        commentId={c.id}
                        myReactions={reactionState.myReactions}
                        onToggle={(emoji) => handleToggleReaction(c.id, emoji)}
                        onClose={() => setOpenPickerFor(null)}
                      />
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(c.id)}
                  aria-label="Delete note"
                  className="flex-shrink-0 min-h-11 min-w-11 text-gray-600 hover:text-red-400 transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a private note… use @G... to mention a Stellar address"
          rows={2}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="self-end min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Add Note
        </button>
      </form>
    </section>
  );
}
