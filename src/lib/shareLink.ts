import crypto from 'crypto';

export type ShareLinkPermission = 'read' | 'comment' | 'read-only';

export interface ShareLink {
  tokenHash: string;
  invoiceId: string;
  permissions: ShareLinkPermission;
  expiresAt: Date;
  maxUses?: number;
  usesConsumed: number;
  createdAt: Date;
  revokedAt?: Date;
  token?: string; // Only returned when creating
}

/**
 * In-memory store for share links.
 * In production, this should be replaced with a database.
 */
const shareLinkStore = new Map<string, ShareLink>();

/**
 * Generate a cryptographically secure random token
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256 (for storage)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Timing-safe token comparison
 */
export function timingSafeCompareToken(provided: string, stored: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(stored));
}

/**
 * Create a new share link
 */
export function createShareLink(
  invoiceId: string,
  permissions: ShareLinkPermission = 'read',
  durationMs: number = 3600000, // 1 hour default
  maxUses?: number
): ShareLink {
  const token = generateShareToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMs);

  const shareLink: ShareLink = {
    tokenHash,
    invoiceId,
    permissions,
    expiresAt,
    maxUses,
    usesConsumed: 0,
    createdAt: now,
    token, // Return the unhashed token once
  };

  shareLinkStore.set(tokenHash, shareLink);
  return shareLink;
}

/**
 * Validate and retrieve a share link by token
 */
export function validateShareLink(
  token: string
): { valid: false; reason: string } | { valid: true; link: ShareLink; permission: ShareLinkPermission } {
  const tokenHash = hashToken(token);
  const link = shareLinkStore.get(tokenHash);

  if (!link) {
    return { valid: false, reason: 'Link not found or revoked' };
  }

  if (link.revokedAt) {
    return { valid: false, reason: 'Link has been revoked' };
  }

  if (new Date() > link.expiresAt) {
    return { valid: false, reason: 'Link has expired' };
  }

  if (link.maxUses && link.usesConsumed >= link.maxUses) {
    return { valid: false, reason: 'Link has reached maximum uses' };
  }

  return { valid: true, link, permission: link.permissions };
}

/**
 * Increment uses for a share link
 */
export function incrementShareLinkUse(tokenHash: string): void {
  const link = shareLinkStore.get(tokenHash);
  if (link) {
    link.usesConsumed += 1;
  }
}

/**
 * Revoke a share link
 */
export function revokeShareLink(tokenHash: string): boolean {
  const link = shareLinkStore.get(tokenHash);
  if (link) {
    link.revokedAt = new Date();
    return true;
  }
  return false;
}

/**
 * Get all active share links for an invoice
 */
export function getShareLinksForInvoice(invoiceId: string): ShareLink[] {
  return Array.from(shareLinkStore.values()).filter((link) => {
    return (
      link.invoiceId === invoiceId &&
      !link.revokedAt &&
      new Date() <= link.expiresAt
    );
  });
}

/**
 * Format duration for display
 */
export function formatShareLinkDuration(ms: number): string {
  const hours = ms / 3600000;
  const days = hours / 24;

  if (hours < 1) {
    const minutes = Math.round(ms / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h !== 1 ? 's' : ''}`;
  }

  const d = Math.round(days);
  return `${d} day${d !== 1 ? 's' : ''}`;
}
