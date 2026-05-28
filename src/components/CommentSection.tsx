"use client";

import { useEffect, useRef, useState } from "react";

interface Comment {
  id: string;
  invoiceId: string;
  walletAddress: string;
  text: string;
  timestamp: number;
}

interface Props {
  invoiceId: string;
  walletAddress: string;
}

const STORAGE_KEY = "stellarsplit_comments";

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

function relativeTime(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

/**
 * CommentSection — off-chain per-invoice notes stored in localStorage.
 * Only shows comments belonging to the connected wallet address.
 */
export default function CommentSection({ invoiceId, walletAddress }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComments(loadComments(invoiceId, walletAddress));
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
    setText("");
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    deleteComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Notes</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 bg-gray-900 rounded-lg px-4 py-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 break-words">{c.text}</p>
                <p className="text-xs text-gray-500 mt-1">{relativeTime(c.timestamp)}</p>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                aria-label="Delete note"
                className="flex-shrink-0 min-h-11 min-w-11 text-gray-600 hover:text-red-400 transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a private note…"
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
