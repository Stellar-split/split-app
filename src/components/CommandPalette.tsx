"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FocusTrap from "@/components/FocusTrap";

interface RouteEntry {
  label: string;
  path: string;
}

interface ParameterizedAction {
  label: string;
  placeholder: string;
  buildPath: (input: string) => string;
}

const ROUTES: RouteEntry[] = [
  { label: "Home", path: "/" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Groups", path: "/groups" },
  { label: "Address Book", path: "/address-book" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Creator Leaderboard", path: "/leaderboard/creators" },
  { label: "Activity", path: "/activity" },
  { label: "History", path: "/history" },
  { label: "Analytics", path: "/analytics" },
  { label: "Revenue", path: "/revenue" },
  { label: "Notifications", path: "/notifications" },
  { label: "Search", path: "/search" },
  { label: "New Invoice", path: "/invoice/new" },
  { label: "Batch Invoices", path: "/invoice/batch" },
  { label: "Import Invoices", path: "/invoice/import" },
  { label: "Compare Invoices", path: "/invoice/compare" },
  { label: "Invoice Templates", path: "/invoice/templates" },
  { label: "Recipient", path: "/recipient" },
  { label: "Batch Pay", path: "/pay/batch" },
  { label: "Settings — Accessibility", path: "/settings/accessibility" },
  { label: "Settings — API", path: "/settings/api" },
  { label: "Settings — API Keys", path: "/settings/api-keys" },
  { label: "Settings — Notifications", path: "/settings/notifications" },
  { label: "Settings — Sync", path: "/settings/sync" },
  { label: "Settings — Verify", path: "/settings/verify" },
];

const PARAMETERIZED_ACTIONS: ParameterizedAction[] = [
  {
    label: "Go to invoice #",
    placeholder: "Enter invoice ID…",
    buildPath: (id: string) => `/invoice/${encodeURIComponent(id)}`,
  },
];

export function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 2 + (q.length / t.length);
  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (lastMatchIndex >= 0 && ti === lastMatchIndex + 1) {
        score += 2;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }
  return qi === q.length ? score / t.length : 0;
}

function defaultNavigate(path: string) {
  window.location.assign(path);
}

type PaletteItem =
  | { type: "route"; entry: RouteEntry; score: number }
  | { type: "action"; action: ParameterizedAction; score: number };

interface CommandPaletteProps {
  onNavigate?: (path: string) => void;
}

export default function CommandPalette({ onNavigate }: CommandPaletteProps = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paramAction, setParamAction] = useState<ParameterizedAction | null>(null);
  const [paramInput, setParamInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    setParamAction(null);
    setParamInput("");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        if (open) close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results: PaletteItem[] = (() => {
    const items: PaletteItem[] = [];
    for (const entry of ROUTES) {
      const score = fuzzyMatch(query, entry.label);
      if (score > 0) items.push({ type: "route", entry, score });
    }
    for (const action of PARAMETERIZED_ACTIONS) {
      const score = fuzzyMatch(query, action.label);
      if (score > 0) items.push({ type: "action", action, score });
    }
    items.sort((a, b) => b.score - a.score);
    return items;
  })();

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  const navigate = (path: string) => {
    close();
    (onNavigate ?? defaultNavigate)(path);
  };

  const activateItem = (item: PaletteItem) => {
    if (item.type === "route") {
      navigate(item.entry.path);
    } else {
      setParamAction(item.action);
      setParamInput("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (paramAction) {
      if (e.key === "Enter" && paramInput.trim()) {
        e.preventDefault();
        navigate(paramAction.buildPath(paramInput.trim()));
      }
      if (e.key === "Backspace" && !paramInput) {
        e.preventDefault();
        setParamAction(null);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) activateItem(item);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={close}
    >
      <FocusTrap onClose={close}>
        <div
          className="w-full max-w-lg rounded-xl border border-gray-700/60 bg-gray-900/95 shadow-2xl shadow-black/60 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            {paramAction ? (
              <>
                <span className="text-sm text-indigo-400 shrink-0">{paramAction.label}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={paramInput}
                  onChange={(e) => setParamInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={paramAction.placeholder}
                  className="flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder-gray-500"
                  aria-label={paramAction.placeholder}
                />
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-500 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages and actions…"
                  className="flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder-gray-500"
                  aria-label="Search pages and actions"
                />
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono text-gray-500 bg-gray-800 border border-gray-700">
                  Esc
                </kbd>
              </>
            )}
          </div>

          {!paramAction && (
            <ul
              ref={listRef}
              className="max-h-72 overflow-y-auto py-1"
              role="listbox"
              aria-label="Results"
            >
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-gray-500">
                  No results found
                </li>
              ) : (
                results.map((item, i) => {
                  const label =
                    item.type === "route" ? item.entry.label : item.action.label;
                  const detail =
                    item.type === "route" ? item.entry.path : "Enter an ID…";
                  return (
                    <li
                      key={label}
                      role="option"
                      aria-selected={i === activeIndex}
                      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm ${
                        i === activeIndex
                          ? "bg-indigo-600/30 text-gray-100"
                          : "text-gray-300 hover:bg-gray-800"
                      }`}
                      onClick={() => activateItem(item)}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <span>{label}</span>
                      <span className="text-xs text-gray-500 truncate ml-4">
                        {detail}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}
