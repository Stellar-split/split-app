"use client";

import { useEffect, useRef, useState } from "react";
import { useInvoiceBookmarks, type BookmarkCollection } from "@/hooks/useInvoiceBookmarks";

// ── BookmarkButton ────────────────────────────────────────────────────────────

interface BookmarkButtonProps {
  invoiceId: string;
  /** Size variant. */
  size?: "sm" | "md";
  /** Whether to show label text beside the icon. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Icon button that toggles the bookmark state for an invoice.
 * Uses the shared `useInvoiceBookmarks` hook (data lives in localStorage).
 */
export function BookmarkButton({
  invoiceId,
  size = "md",
  showLabel = false,
  className = "",
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useInvoiceBookmarks();
  const bookmarked = isBookmarked(invoiceId);

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const btnSize = size === "sm" ? "p-1.5" : "p-2";

  return (
    <button
      type="button"
      onClick={() => toggleBookmark(invoiceId)}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this invoice"}
      aria-pressed={bookmarked}
      title={bookmarked ? "Remove bookmark" : "Bookmark this invoice"}
      className={`inline-flex items-center gap-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${btnSize} ${
        bookmarked
          ? "text-amber-400 hover:text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/50"
          : "text-gray-400 hover:text-amber-400 bg-gray-800 hover:bg-gray-700 border border-gray-700"
      } ${className}`}
    >
      {bookmarked ? (
        // Filled bookmark
        <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
        </svg>
      ) : (
        // Outline bookmark
        <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      )}
      {showLabel && (
        <span className="text-xs font-medium">
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </span>
      )}
    </button>
  );
}

// ── AddToCollectionMenu ───────────────────────────────────────────────────────

interface AddToCollectionMenuProps {
  invoiceId: string;
  collections: BookmarkCollection[];
  onAdd: (collectionId: string) => void;
  onRemove: (collectionId: string) => void;
  isInCollection: (collectionId: string) => boolean;
  onClose: () => void;
}

function AddToCollectionMenu({
  invoiceId,
  collections,
  onAdd,
  onRemove,
  isInCollection,
  onClose,
}: AddToCollectionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute z-50 top-full mt-1 right-0 w-56 rounded-xl border border-gray-700 bg-gray-900 shadow-xl py-1"
    >
      {collections.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-500">No collections yet. Create one below.</p>
      ) : (
        collections.map((col) => {
          const inCol = isInCollection(col.id);
          return (
            <button
              key={col.id}
              type="button"
              role="menuitem"
              onClick={() => (inCol ? onRemove(col.id) : onAdd(col.id))}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors text-left"
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  inCol ? "bg-indigo-600 border-indigo-500" : "border-gray-600"
                }`}
              >
                {inCol && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="truncate text-gray-200">{col.name}</span>
              <span className="ml-auto text-xs text-gray-500 shrink-0">
                {col.invoiceIds.length}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ── InvoiceBookmarkActions ────────────────────────────────────────────────────

interface InvoiceBookmarkActionsProps {
  invoiceId: string;
  className?: string;
}

/**
 * Combined bookmark + "add to collection" control for an invoice detail page or card.
 */
export function InvoiceBookmarkActions({ invoiceId, className = "" }: InvoiceBookmarkActionsProps) {
  const { isBookmarked, toggleBookmark, collections, addToCollection, removeFromCollection, isInCollection } =
    useInvoiceBookmarks();
  const bookmarked = isBookmarked(invoiceId);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <BookmarkButton invoiceId={invoiceId} showLabel />

      {/* Add to collection */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowCollectionMenu((v) => !v)}
          aria-expanded={showCollectionMenu}
          aria-haspopup="menu"
          aria-label="Add to collection"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Collections
        </button>
        {showCollectionMenu && (
          <AddToCollectionMenu
            invoiceId={invoiceId}
            collections={collections}
            onAdd={(cid) => addToCollection(cid, invoiceId)}
            onRemove={(cid) => removeFromCollection(cid, invoiceId)}
            isInCollection={(cid) => isInCollection(cid, invoiceId)}
            onClose={() => setShowCollectionMenu(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── InvoiceCollectionsPanel ───────────────────────────────────────────────────

interface InvoiceCollectionsPanelProps {
  /** Callback with an invoice ID to navigate to that invoice. */
  onInvoiceClick?: (invoiceId: string) => void;
  className?: string;
}

/**
 * Full panel for managing bookmarks and collections.
 * Lists all bookmarked invoices + organises them into named collections.
 */
export default function InvoiceCollectionsPanel({
  onInvoiceClick,
  className = "",
}: InvoiceCollectionsPanelProps) {
  const {
    bookmarks,
    collections,
    toggleBookmark,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    isInCollection,
  } = useInvoiceBookmarks();

  const [newCollectionName, setNewCollectionName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bookmarks" | "collections">("bookmarks");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  const handleCreate = () => {
    const err = createCollection(newCollectionName);
    if (err) {
      setCreateError(err);
      return;
    }
    setNewCollectionName("");
    setCreateError(null);
  };

  const handleRename = (id: string) => {
    const err = renameCollection(id, renameInput);
    if (err) {
      setRenameError(err);
      return;
    }
    setRenamingId(null);
    setRenameInput("");
    setRenameError(null);
  };

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const collectionInvoices = activeCollection
    ? bookmarks.filter((b) => activeCollection.invoiceIds.includes(b.invoiceId))
    : [];

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
          </svg>
          Bookmarks & Collections
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800" role="tablist">
        {(["bookmarks", "collections"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
              setActiveCollectionId(null);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab}{" "}
            <span className="ml-1 text-xs opacity-70">
              ({tab === "bookmarks" ? bookmarks.length : collections.length})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* ── Bookmarks tab ── */}
        {activeTab === "bookmarks" && (
          <div>
            {bookmarks.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                No bookmarks yet. Bookmark invoices to see them here.
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {bookmarks.map((bookmark) => (
                  <li key={bookmark.invoiceId} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => onInvoiceClick?.(bookmark.invoiceId)}
                        className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors truncate block max-w-full"
                        title={`Open invoice ${bookmark.invoiceId}`}
                      >
                        #{bookmark.invoiceId}
                      </button>
                      {bookmark.note && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{bookmark.note}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(bookmark.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Add to collection dropdown */}
                      {collections.length > 0 && (
                        <select
                          aria-label={`Add invoice ${bookmark.invoiceId} to collection`}
                          defaultValue=""
                          onChange={(e) => {
                            const colId = e.target.value;
                            if (!colId) return;
                            const inCol = isInCollection(colId, bookmark.invoiceId);
                            if (inCol) removeFromCollection(colId, bookmark.invoiceId);
                            else addToCollection(colId, bookmark.invoiceId);
                            e.target.value = "";
                          }}
                          className="px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="" disabled>
                            + Collection
                          </option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {isInCollection(c.id, bookmark.invoiceId) ? `✓ ${c.name}` : c.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {/* Remove bookmark */}
                      <button
                        type="button"
                        onClick={() => toggleBookmark(bookmark.invoiceId)}
                        aria-label={`Remove bookmark for invoice ${bookmark.invoiceId}`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Collections tab ── */}
        {activeTab === "collections" && (
          <div>
            {/* Collection detail view */}
            {activeCollectionId && activeCollection ? (
              <div>
                <button
                  type="button"
                  onClick={() => setActiveCollectionId(null)}
                  className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to collections
                </button>
                <h3 className="text-sm font-bold text-white mb-3">{activeCollection.name}</h3>
                {collectionInvoices.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">This collection is empty.</p>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {collectionInvoices.map((b) => (
                      <li key={b.invoiceId} className="py-3 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onInvoiceClick?.(b.invoiceId)}
                          className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          #{b.invoiceId}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCollection(activeCollectionId, b.invoiceId)}
                          aria-label={`Remove invoice ${b.invoiceId} from collection`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>
                {/* Create collection form */}
                <div className="flex gap-2 mb-5">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => {
                      setNewCollectionName(e.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="New collection name…"
                    maxLength={40}
                    aria-label="New collection name"
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newCollectionName.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                  >
                    Create
                  </button>
                </div>
                {createError && <p className="text-xs text-red-400 -mt-3 mb-3">{createError}</p>}

                {/* Collection list */}
                {collections.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    No collections yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {collections.map((col) => (
                      <li key={col.id} className="py-3 flex items-center gap-2">
                        {renamingId === col.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={renameInput}
                              onChange={(e) => {
                                setRenameInput(e.target.value);
                                setRenameError(null);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && handleRename(col.id)}
                              maxLength={40}
                              aria-label={`Rename collection ${col.name}`}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRename(col.id)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingId(null);
                                setRenameError(null);
                              }}
                              className="px-2 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveCollectionId(col.id)}
                              className="flex-1 text-left min-w-0"
                            >
                              <span className="text-sm text-gray-200 font-medium hover:text-white transition-colors truncate block">
                                {col.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {col.invoiceIds.length} invoice
                                {col.invoiceIds.length !== 1 ? "s" : ""}
                              </span>
                            </button>
                            {/* Rename */}
                            <button
                              type="button"
                              aria-label={`Rename collection ${col.name}`}
                              onClick={() => {
                                setRenamingId(col.id);
                                setRenameInput(col.name);
                                setRenameError(null);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              type="button"
                              aria-label={`Delete collection ${col.name}`}
                              onClick={() => deleteCollection(col.id)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {renamingId === col.id && renameError && (
                          <p className="text-xs text-red-400 mt-1">{renameError}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
