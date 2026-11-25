"use client";

import { useEffect, useState } from "react";
import TagInput from "./TagInput";
import TagPills from "./TagPills";
import { useInvoiceTags } from "@/hooks/useInvoiceTags";

interface InvoiceTagEditorProps {
  invoiceId: string;
  /** When false, tags render read-only (e.g. for non-creators). */
  editable?: boolean;
  className?: string;
}

/**
 * InvoiceTagEditor — tag display and editing for the invoice detail page.
 *
 * Reads from the shared tag cache, so removing a tag here updates the
 * dashboard's pills and filter list without a refetch. Writes are optimistic:
 * `saveTags` applies the change immediately and rolls back if the PATCH fails.
 */
export default function InvoiceTagEditor({
  invoiceId,
  editable = true,
  className = "",
}: InvoiceTagEditorProps) {
  const { tagsByInvoice, allTags, saveTags, error } = useInvoiceTags();
  const tags = tagsByInvoice[invoiceId] ?? [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);

  // Keep the draft in step with server state while not actively editing.
  useEffect(() => {
    if (!editing) setDraft(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsByInvoice[invoiceId]?.join("|"), editing]);

  const commit = (next: string[]) => {
    setDraft(next);
    saveTags(invoiceId, next).catch(() => {
      // saveTags rolls the cache back; mirror that in the local draft.
      setDraft(tagsByInvoice[invoiceId] ?? []);
    });
  };

  if (!editable) {
    return tags.length > 0 ? <TagPills tags={tags} size="md" className={className} /> : null;
  }

  return (
    <div className={className}>
      {editing ? (
        <div className="max-w-md">
          <TagInput
            value={draft}
            onChange={commit}
            suggestions={allTags}
            label="Tags"
            placeholder="Add a tag and press Enter"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="mt-2 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <TagPills tags={tags} onRemove={(tag) => commit(tags.filter((t) => t !== tag))} size="md" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-dashed border-gray-600 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {tags.length > 0 ? "+ Edit tags" : "+ Add tags"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
