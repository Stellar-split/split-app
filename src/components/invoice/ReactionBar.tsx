"use client";

import { ALLOWED_EMOJIS, type AllowedEmoji } from "@/lib/commentStore";

const EMOJI_LABELS: Record<AllowedEmoji, string> = {
  "👍": "thumbs up",
  "❤️": "heart",
  "✅": "checkmark",
  "❓": "question",
};

interface Props {
  counts: Record<string, number>;
  active: AllowedEmoji[];
  onToggle: (emoji: AllowedEmoji) => void;
  disabled?: boolean;
}

export default function ReactionBar({ counts, active, onToggle, disabled }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Reactions">
      {ALLOWED_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const isActive = active.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(emoji)}
            aria-pressed={isActive}
            aria-label={`React with ${EMOJI_LABELS[emoji]}${count > 0 ? ` (${count})` : ""}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
