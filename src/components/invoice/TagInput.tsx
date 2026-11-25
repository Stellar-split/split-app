"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MAX_TAGS_PER_INVOICE,
  normalizeTag,
  splitTagInput,
  suggestTags,
  tagColorClass,
} from "@/lib/invoiceTags";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tag names used for autocomplete. */
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * TagInput — pill-style combobox for free-text tags.
 *
 * Enter and comma both commit the current text. Autocomplete offers up to 10
 * existing tags, navigable with the arrow keys; Backspace on an empty field
 * removes the last pill.
 *
 * Implemented against the ARIA 1.2 combobox pattern directly rather than with
 * a headless component library — this repo has no such dependency, and the
 * behaviour needed here is small enough to own.
 */
export default function TagInput({
  value,
  onChange,
  suggestions = [],
  label = "Tags",
  placeholder = "Add a tag and press Enter",
  disabled = false,
  id,
}: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? `tag-input-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => suggestTags(text, suggestions, value),
    [text, suggestions, value]
  );

  useEffect(() => {
    setActiveOption(-1);
  }, [text]);

  // Close the listbox on an outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const atLimit = value.length >= MAX_TAGS_PER_INVOICE;

  const commit = (raw: string) => {
    const incoming = splitTagInput(raw);
    if (incoming.length === 0) {
      setText("");
      return;
    }
    const merged = [...value];
    for (const tag of incoming) {
      if (merged.length >= MAX_TAGS_PER_INVOICE) break;
      if (!merged.includes(tag)) merged.push(tag);
    }
    if (merged.length !== value.length) onChange(merged);
    setText("");
    setOpen(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeOption >= 0 && matches[activeOption]) {
        commit(matches[activeOption]);
      } else {
        commit(text);
      }
      return;
    }

    if (e.key === ",") {
      e.preventDefault();
      commit(text);
      return;
    }

    if (e.key === "Backspace" && text === "" && value.length > 0) {
      e.preventDefault();
      removeTag(value[value.length - 1]);
      return;
    }

    if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveOption((prev) => (prev + 1) % matches.length);
      return;
    }

    if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveOption((prev) => (prev <= 0 ? matches.length - 1 : prev - 1));
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setActiveOption(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>

      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            data-testid={`tag-chip-${tag}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tagColorClass(
              tag
            )}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              className="ml-0.5 rounded-full px-0.5 leading-none opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ×
            </button>
          </span>
        ))}

        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeOption >= 0 ? `${listboxId}-option-${activeOption}` : undefined
          }
          autoComplete="off"
          value={text}
          disabled={disabled || atLimit}
          placeholder={atLimit ? `Tag limit (${MAX_TAGS_PER_INVOICE}) reached` : placeholder}
          onChange={(e) => {
            const next = e.target.value;
            // Handles pasted "a, b, c" as well as typed commas.
            if (next.includes(",")) {
              const [head, ...rest] = next.split(",");
              commit(head);
              setText(rest.join(",").trimStart());
            } else {
              setText(next);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Commit a half-typed tag so it isn't silently lost on blur.
            if (normalizeTag(text)) commit(text);
          }}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-lg"
        >
          {matches.map((tag, i) => (
            <li
              key={tag}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeOption}
            >
              <button
                type="button"
                // onMouseDown fires before the input's blur handler.
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(tag);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  i === activeOption ? "bg-gray-700 text-white" : "text-gray-200 hover:bg-gray-700"
                }`}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
