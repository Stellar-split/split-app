/**
 * creatorMessages.ts — Creator ↔ Payer messaging library.
 *
 * Messages are stored in localStorage under a per-invoice key.
 * Each message includes the sender address, a role tag (creator/payer),
 * the text, a local timestamp, and an optional read receipt.
 *
 * Issue #812: Add creator messaging system for payer communication.
 */

export type MessageRole = "creator" | "payer" | "system";

export interface CreatorMessage {
  id: string;
  invoiceId: string;
  sender: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  readBy: string[]; // addresses that have "read" the message
}

export interface MessageThread {
  invoiceId: string;
  messages: CreatorMessage[];
  unreadCount: number;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "creator-messages-";
const UNREAD_KEY_PREFIX = "creator-messages-unread-";

function storageKey(invoiceId: string): string {
  return `${STORAGE_PREFIX}${invoiceId}`;
}

function unreadKey(invoiceId: string, address: string): string {
  return `${UNREAD_KEY_PREFIX}${invoiceId}-${address}`;
}

// ── ID generation ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Parse / validate ──────────────────────────────────────────────────────────

function isValidMessage(value: unknown): value is CreatorMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.invoiceId === "string" &&
    typeof m.sender === "string" &&
    typeof m.role === "string" &&
    typeof m.text === "string" &&
    typeof m.timestamp === "number" &&
    Array.isArray(m.readBy)
  );
}

function parseMessages(raw: string | null): CreatorMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMessage).sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load all messages for a given invoice thread.
 */
export function loadMessages(invoiceId: string): CreatorMessage[] {
  if (typeof window === "undefined") return [];
  return parseMessages(localStorage.getItem(storageKey(invoiceId)));
}

/**
 * Post a new message to an invoice thread.
 */
export function postMessage(
  invoiceId: string,
  sender: string,
  role: MessageRole,
  text: string,
): CreatorMessage {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message text must not be empty.");

  const message: CreatorMessage = {
    id: generateId(),
    invoiceId,
    sender,
    role,
    text: trimmed,
    timestamp: Date.now(),
    readBy: [sender], // sender has implicitly read their own message
  };

  const existing = loadMessages(invoiceId);
  localStorage.setItem(
    storageKey(invoiceId),
    JSON.stringify([...existing, message]),
  );

  return message;
}

/**
 * Mark all messages in a thread as read by the given address.
 */
export function markThreadRead(invoiceId: string, address: string): void {
  if (typeof window === "undefined") return;

  const messages = loadMessages(invoiceId);
  const updated = messages.map((m) =>
    m.readBy.includes(address) ? m : { ...m, readBy: [...m.readBy, address] },
  );

  localStorage.setItem(storageKey(invoiceId), JSON.stringify(updated));

  // Clear unread counter
  localStorage.removeItem(unreadKey(invoiceId, address));
}

/**
 * Count unread messages for a given address in a thread.
 */
export function countUnread(invoiceId: string, address: string): number {
  const messages = loadMessages(invoiceId);
  return messages.filter(
    (m) => m.sender !== address && !m.readBy.includes(address),
  ).length;
}

/**
 * Get a full message thread including unread count for the viewer.
 */
export function getThread(invoiceId: string, viewerAddress: string): MessageThread {
  const messages = loadMessages(invoiceId);
  const unreadCount = messages.filter(
    (m) => m.sender !== viewerAddress && !m.readBy.includes(viewerAddress),
  ).length;

  return { invoiceId, messages, unreadCount };
}

/**
 * Delete a single message by ID (only the original sender may delete).
 */
export function deleteMessage(
  invoiceId: string,
  messageId: string,
  callerAddress: string,
): boolean {
  const messages = loadMessages(invoiceId);
  const target = messages.find((m) => m.id === messageId);
  if (!target || target.sender !== callerAddress) return false;

  const updated = messages.filter((m) => m.id !== messageId);
  localStorage.setItem(storageKey(invoiceId), JSON.stringify(updated));
  return true;
}

/**
 * Clear all messages in a thread (for moderation / testing).
 */
export function clearThread(invoiceId: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(storageKey(invoiceId));
  }
}

/**
 * Determine the role of an address in an invoice.
 */
export function resolveRole(
  address: string,
  creatorAddress: string,
  recipientAddresses: string[],
): MessageRole {
  if (address === creatorAddress) return "creator";
  if (recipientAddresses.includes(address)) return "payer";
  return "system";
}

/**
 * Format a timestamp for display in the message panel.
 */
export function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
