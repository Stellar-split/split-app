"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  loadMessages,
  postMessage,
  markThreadRead,
  deleteMessage,
  resolveRole,
  formatMessageTime,
  type CreatorMessage,
  type MessageRole,
} from "@/lib/creatorMessages";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  invoiceId: string;
  creatorAddress: string;
  recipientAddresses: string[];
  /** The currently connected wallet address — null when not logged in. */
  currentAddress: string | null;
  /** Optional CSS class applied to the root element. */
  className?: string;
}

// ── Role label helpers ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<MessageRole, string> = {
  creator: "Creator",
  payer: "Payer",
  system: "System",
};

const ROLE_BADGE: Record<MessageRole, string> = {
  creator: "bg-indigo-600/20 text-indigo-400 border-indigo-600/30",
  payer: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  system: "bg-gray-600/20 text-gray-400 border-gray-600/30",
};

// ── Truncate helper ───────────────────────────────────────────────────────────

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * CreatorMessagePanel — invoice-level messaging between the invoice creator
 * and payers/recipients.
 *
 * Uses localStorage as the persistence layer (same pattern as InvoiceChat).
 * Automatically marks messages as read when the panel is open.
 *
 * Issue #812: Add creator messaging system for payer communication.
 */
export default function CreatorMessagePanel({
  invoiceId,
  creatorAddress,
  recipientAddresses,
  currentAddress,
  className = "",
}: Props) {
  const [messages, setMessages] = useState<CreatorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load & refresh messages ─────────────────────────────────────────────

  const refresh = useCallback(() => {
    const msgs = loadMessages(invoiceId);
    setMessages(msgs);

    if (currentAddress) {
      const unread = msgs.filter(
        (m) =>
          m.sender !== currentAddress &&
          !m.readBy.includes(currentAddress),
      ).length;
      setUnreadCount(unread);
    }
  }, [invoiceId, currentAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Mark read when panel opens ──────────────────────────────────────────

  useEffect(() => {
    if (isOpen && currentAddress) {
      markThreadRead(invoiceId, currentAddress);
      setUnreadCount(0);
    }
  }, [isOpen, invoiceId, currentAddress]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // ── Send message ────────────────────────────────────────────────────────

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!currentAddress || !input.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const role = resolveRole(
        currentAddress,
        creatorAddress,
        recipientAddresses,
      );
      postMessage(invoiceId, currentAddress, role, input.trim());
      setInput("");
      refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete message ──────────────────────────────────────────────────────

  const handleDelete = (msgId: string) => {
    if (!currentAddress) return;
    const deleted = deleteMessage(invoiceId, msgId, currentAddress);
    if (deleted) refresh();
  };

  // ── Viewer role ─────────────────────────────────────────────────────────

  const viewerRole = currentAddress
    ? resolveRole(currentAddress, creatorAddress, recipientAddresses)
    : null;

  const canSend =
    !!currentAddress &&
    (viewerRole === "creator" || viewerRole === "payer");

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className}`}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={`message-panel-${invoiceId}`}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Messages
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          id={`message-panel-${invoiceId}`}
          className="mt-3 flex flex-col bg-gray-900 border border-gray-700 rounded-xl overflow-hidden"
          role="region"
          aria-label="Invoice messages"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-semibold text-gray-200">
              Invoice #{invoiceId} — Messages
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Close messages"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Message list */}
          <div
            className="flex-1 overflow-y-auto max-h-72 px-4 py-3 space-y-3"
            aria-live="polite"
            aria-label="Message thread"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No messages yet. Start the conversation below.
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender === currentAddress;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
                  >
                    {/* Sender + role */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">
                        {truncateAddr(msg.sender)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_BADGE[msg.role]}`}
                      >
                        {ROLE_LABELS[msg.role]}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={[
                        "relative max-w-xs rounded-2xl px-3 py-2 text-sm group",
                        isOwn
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-gray-800 text-gray-100 rounded-bl-sm",
                      ].join(" ")}
                    >
                      {msg.text}

                      {/* Delete own messages */}
                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs"
                          aria-label="Delete message"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-gray-500">
                      {formatMessageTime(msg.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>

          {/* Input */}
          {canSend ? (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 px-4 py-3 border-t border-gray-700"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                maxLength={500}
                aria-label="Message input"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSubmitting}
                className="flex-shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Send
              </button>
            </form>
          ) : (
            <p className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
              {currentAddress
                ? "Only the creator and recipients may send messages."
                : "Connect your wallet to send messages."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
