const STORAGE_KEY = "stellarsplit-notify-invoices";
const PREFS_KEY = "stellarsplit-notification-prefs";

interface NotificationPreferences {
  paymentReceived: boolean;
  invoiceFunded: boolean;
  deadlineApproaching: boolean;
  invoiceReleased: boolean;
  invoiceRefunded: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  paymentReceived: true,
  invoiceFunded: true,
  deadlineApproaching: true,
  invoiceReleased: true,
  invoiceRefunded: true,
};

function getPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Request browser notification permission; returns current permission if unsupported. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission !== "default") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

/** Send a browser notification for an invoice status change. */
export function sendBrowserNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    icon: "/icons/icon-192.png",
    ...options,
  });
}

/** Invoice IDs the user opted into for release notifications. */
export function getSubscribedInvoiceIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** Persist subscribed invoice IDs. */
export function setSubscribedInvoiceIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function subscribeToInvoice(invoiceId: string): void {
  const ids = getSubscribedInvoiceIds();
  if (!ids.includes(invoiceId)) {
    setSubscribedInvoiceIds([...ids, invoiceId]);
  }
}

export function isSubscribedToInvoice(invoiceId: string): boolean {
  return getSubscribedInvoiceIds().includes(invoiceId);
}

/** Notify when a payment is received. */
export function notifyPaymentReceived(invoiceId: string, amount: string): void {
  const prefs = getPreferences();
  if (!prefs.paymentReceived) return;
  sendBrowserNotification(`Payment received on Invoice #${invoiceId}`, {
    body: `${amount} USDC received.`,
    tag: `payment-received-${invoiceId}`,
  });
}

/** Notify when an invoice is fully funded. */
export function notifyInvoiceFunded(invoiceId: string, fundedLabel: string): void {
  const prefs = getPreferences();
  if (!prefs.invoiceFunded) return;
  sendBrowserNotification(`Invoice #${invoiceId} fully funded`, {
    body: `${fundedLabel} USDC received.`,
    tag: `invoice-funded-${invoiceId}`,
  });
}

/** Notify when an invoice deadline is approaching. */
export function notifyDeadlineApproaching(invoiceId: string, daysLeft: number): void {
  const prefs = getPreferences();
  if (!prefs.deadlineApproaching) return;
  sendBrowserNotification(`Invoice #${invoiceId} deadline approaching`, {
    body: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`,
    tag: `deadline-approaching-${invoiceId}`,
  });
}

/** Notify when an invoice transitions to Released. */
export function notifyInvoiceReleased(invoiceId: string, fundedLabel: string): void {
  const prefs = getPreferences();
  if (!prefs.invoiceReleased) return;
  sendBrowserNotification(`Invoice #${invoiceId} released`, {
    body: `Fully funded with ${fundedLabel} USDC.`,
    tag: `invoice-released-${invoiceId}`,
  });
}

/** Notify when an invoice is refunded. */
export function notifyInvoiceRefunded(invoiceId: string): void {
  const prefs = getPreferences();
  if (!prefs.invoiceRefunded) return;
  sendBrowserNotification(`Invoice #${invoiceId} refunded`, {
    body: "All payments have been refunded.",
    tag: `invoice-refunded-${invoiceId}`,
  });
}

/** Stellar address regex: G followed by 55 uppercase alphanumeric chars. */
const STELLAR_ADDRESS_RE = /\bG[A-Z0-9]{55}\b/g;

/**
 * Parse @G... mentions from comment text.
 * Returns unique valid Stellar addresses that were mentioned.
 */
export function parseMentions(text: string): string[] {
  const matches = text.match(STELLAR_ADDRESS_RE) ?? [];
  return [...new Set(matches)];
}

/**
 * Fire a browser notification to the mentioned address (current user).
 * Skips if mentionedAddress === commenterAddress (self-mention).
 */
export function notifyMention(
  mentionedAddress: string,
  commenterAddress: string,
  invoiceId: string
): void {
  if (mentionedAddress === commenterAddress) return;
  sendBrowserNotification(`You were mentioned on Invoice #${invoiceId}`, {
    body: `${commenterAddress.slice(0, 8)}… mentioned you in a comment.`,
    tag: `mention-${invoiceId}-${mentionedAddress}`,
  });
}
