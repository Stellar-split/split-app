"use client";

import { useState } from "react";
import { useDraftCollaboration } from "@/hooks/useDraftCollaboration";

interface DraftCollaborationPanelProps {
  draftId: string;
}

/**
 * Presence avatars, activity feed and comments for a collaboratively
 * edited invoice draft. See useDraftCollaboration for the sync layer.
 */
export default function DraftCollaborationPanel({ draftId }: DraftCollaborationPanelProps) {
  const { collaborators, activity, comments, postComment } = useDraftCollaboration(draftId);
  const [commentText, setCommentText] = useState("");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="draft-collab-body"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">Collaborators</span>
          <span className="flex -space-x-2" aria-label={`${collaborators.length} active editor(s)`}>
            {collaborators.slice(0, 5).map((c) => (
              <span
                key={c.id}
                title={c.name}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-900 text-[10px] font-semibold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </span>
        </span>
        <span className="text-xs text-gray-500">{expanded ? "Hide" : "Show"} activity & comments</span>
      </button>

      {expanded && (
        <div id="draft-collab-body" className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Activity</h3>
            <ul className="space-y-1 max-h-32 overflow-y-auto text-sm" aria-live="polite">
              {activity.length === 0 && <li className="text-gray-400">No activity yet.</li>}
              {activity
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="text-gray-600 dark:text-gray-300">
                    <span className="font-medium">{event.collaboratorName}</span> {event.message}
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Comments</h3>
            <ul className="space-y-2 max-h-40 overflow-y-auto text-sm mb-2">
              {comments.length === 0 && <li className="text-gray-400">No comments yet.</li>}
              {comments.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.collaboratorName}:</span> {c.text}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                postComment(commentText);
                setCommentText("");
              }}
              className="flex gap-2"
            >
              <label htmlFor="draft-comment-input" className="sr-only">
                Add a comment
              </label>
              <input
                id="draft-comment-input"
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment for other editors..."
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
