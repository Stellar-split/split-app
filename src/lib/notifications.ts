export function notifySubscriptionResumed(id: string): void {}

export function notifySubscriptionModified(id: string): void {}

export function notifySubscriptionPaused(id: string): void {}

export function notifySubscriptionCancelled(id: string): void {}

export function addNotification(notification: any): void {}

export function sendPushNotification(title: string, options: any): void {}

/** Matches a whole-token `@G...` mention (G + 55 uppercase alphanumerics). */
const MENTION_RE = /(?:^|[^A-Za-z0-9])@(G[A-Z0-9]{55})(?![A-Za-z0-9])/g;

/**
 * Extract unique Stellar public addresses mentioned in `text`.
 * Only whole-token `@G...` patterns are considered; repeats are deduplicated.
 */
export function parseMentions(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(MENTION_RE)) {
    const address = match[1];
    if (!found.includes(address)) found.push(address);
  }
  return found;
}

/**
 * Show a browser notification for a mention, unless the mentioned address is
 * the commenter themselves.
 */
export function notifyMention(
  mentionedAddress: string,
  commenterAddress: string,
  invoiceId: string
): void {
  if (!mentionedAddress || mentionedAddress === commenterAddress) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(`You were mentioned in invoice ${invoiceId}`, {
    body: `Mentioned by ${commenterAddress}`,
    tag: `mention-${mentionedAddress}-${invoiceId}`,
  });
}
