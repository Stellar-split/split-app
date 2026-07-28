"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { truncateAddress } from "@stellar-split/sdk";
import ReactionBar from "./ReactionBar";
import type { AllowedEmoji } from "@/lib/commentStore";
import RelativeTime from "@/components/ui/RelativeTime";

export interface CommentWithReactions {
  id: string;
  invoiceId: string;
  authorAddress: string;
  text: string;
  createdAt: number;
  reactions: Record<string, number>;
  myReactions: AllowedEmoji[];
}

interface Props {
  comment: CommentWithReactions;
  canDelete: boolean;
  onDelete: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: AllowedEmoji) => void;
  reactionsDisabled?: boolean;
}

export default function CommentBubble({
  comment,
  canDelete,
  onDelete,
  onToggleReaction,
  reactionsDisabled,
}: Props) {
  const initial = comment.authorAddress.slice(0, 1).toUpperCase();

  return (
    <li className="flex items-start gap-3 bg-gray-900 rounded-lg px-4 py-3">
      <span
        aria-hidden="true"
        className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 font-semibold flex items-center justify-center text-sm"
      >
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-200 font-mono truncate">
              {truncateAddress(comment.authorAddress)}
            </span>
            <RelativeTime iso={new Date(comment.createdAt).toISOString()} className="text-xs text-gray-500 shrink-0" />
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              aria-label="Delete comment"
              className="flex-shrink-0 min-h-8 min-w-8 text-gray-600 hover:text-red-400 transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ✕
            </button>
          )}
        </div>
        <div
          className="text-sm text-gray-200 mt-1 break-words
            [&_p]:my-1 [&_strong]:font-semibold [&_em]:italic
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
            [&_code]:bg-gray-800 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
            [&_a]:text-indigo-400 [&_a]:underline"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.text}</ReactMarkdown>
        </div>
        <div className="mt-2">
          <ReactionBar
            counts={comment.reactions}
            active={comment.myReactions}
            onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
            disabled={reactionsDisabled}
          />
        </div>
      </div>
    </li>
  );
}
