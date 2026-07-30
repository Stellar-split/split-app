"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CommentBubble, { type CommentWithReactions } from "./CommentBubble";
import { getOrCreateAnonymousReactorId } from "@/lib/anonymousReactor";
import type { AllowedEmoji } from "@/lib/commentStore";
import { apiFetch } from "@/lib/apiClient";

interface Props {
  invoiceId: string;
  publicKey: string | null;
  isCreator: boolean;
  coCreatorWritePermission: boolean;
}

/**
 * CommentThread — shared, real-time comment thread for an invoice.
 * Any viewer can react with emoji; only wallet-connected users can post text.
 */
export default function CommentThread({
  invoiceId,
  publicKey,
  isCreator,
  coCreatorWritePermission,
}: Props) {
  const [comments, setComments] = useState<CommentWithReactions[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const reactorId = useRef<string>("");

  if (!reactorId.current) {
    reactorId.current = publicKey ?? getOrCreateAnonymousReactorId();
  }

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/invoices/${invoiceId}/comments?reactorId=${encodeURIComponent(reactorId.current)}`
      );
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    const source = new EventSource(`/api/invoices/${invoiceId}/comments/stream`);

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "comment-added") {
          setComments((prev) =>
            prev.some((c) => c.id === parsed.comment.id)
              ? prev
              : [...prev, { ...parsed.comment, reactions: {}, myReactions: [] }]
          );
        } else if (parsed.type === "comment-deleted") {
          setComments((prev) => prev.filter((c) => c.id !== parsed.commentId));
        } else if (parsed.type === "reaction-updated") {
          setComments((prev) =>
            prev.map((c) => (c.id === parsed.commentId ? { ...c, reactions: parsed.counts } : c))
          );
        }
      } catch {
        // Ignore malformed events (e.g. keep-alive comments already filtered by EventSource).
      }
    };

    return () => source.close();
  }, [invoiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !publicKey) return;

    setPosting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorAddress: publicKey, text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to post comment.");
      setText("");
      setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await apiFetch(`/api/invoices/${invoiceId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterAddress: publicKey ?? "",
          coCreatorWritePermission,
        }),
      });
    } catch {
      fetchComments();
    }
  };

  const handleToggleReaction = async (commentId: string, emoji: AllowedEmoji) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const isActive = c.myReactions.includes(emoji);
        const nextCount = Math.max(0, (c.reactions[emoji] ?? 0) + (isActive ? -1 : 1));
        return {
          ...c,
          reactions: { ...c.reactions, [emoji]: nextCount },
          myReactions: isActive ? c.myReactions.filter((e) => e !== emoji) : [...c.myReactions, emoji],
        };
      })
    );

    try {
      await apiFetch(`/api/invoices/${invoiceId}/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, reactorId: reactorId.current }),
      });
    } catch {
      fetchComments();
    }
  };

  const canDelete = (comment: CommentWithReactions) =>
    comment.authorAddress === publicKey || isCreator || coCreatorWritePermission;

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="sr-only">
        Comments
      </h2>

      {loading ? (
        <p className="text-sm text-gray-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              canDelete={canDelete(c)}
              onDelete={handleDelete}
              onToggleReaction={handleToggleReaction}
            />
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-red-400 text-sm mb-3">
          {error}
        </p>
      )}

      {publicKey ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment… supports **bold**, _italic_, `code`, and lists"
            rows={2}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!text.trim() || posting}
            className="self-end min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {posting ? "Posting…" : "Comment"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-400 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
          Sign in to comment. You can still react with emoji above.
        </p>
      )}
    </section>
  );
}
