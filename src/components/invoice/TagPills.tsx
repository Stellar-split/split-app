"use client";

import { tagColorClass } from "@/lib/invoiceTags";

interface TagPillsProps {
  tags: readonly string[];
  /** When set, each pill gets a remove button calling this with the tag. */
  onRemove?: (tag: string) => void;
  /** Cap the number rendered; the remainder collapses into a "+N" pill. */
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * TagPills — colour-coded tag pills shared by invoice cards and the detail page.
 */
export default function TagPills({
  tags,
  onRemove,
  max,
  size = "sm",
  className = "",
}: TagPillsProps) {
  if (tags.length === 0) return null;

  const visible = max ? tags.slice(0, max) : tags;
  const overflow = tags.length - visible.length;
  const sizeClass = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Tags">
      {visible.map((tag) => (
        <li key={tag}>
          <span
            data-testid={`tag-pill-${tag}`}
            className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClass} ${tagColorClass(
              tag
            )}`}
          >
            {tag}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  // Cards are wrapped in links — don't navigate on remove.
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(tag);
                }}
                aria-label={`Remove tag ${tag}`}
                className="-mr-0.5 ml-0.5 rounded-full px-0.5 leading-none opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                ×
              </button>
            )}
          </span>
        </li>
      ))}
      {overflow > 0 && (
        <li>
          <span
            className={`inline-flex items-center rounded-full border border-gray-600 bg-gray-700/40 font-medium text-gray-300 ${sizeClass}`}
          >
            +{overflow}
          </span>
        </li>
      )}
    </ul>
  );
}
