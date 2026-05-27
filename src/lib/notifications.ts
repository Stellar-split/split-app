const STORAGE_KEY = "stellarsplit-notify-invoices";

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

/** Notify when an invoice transitions to Released. */
export function notifyInvoiceReleased(invoiceId: string, fundedLabel: string): void {
  sendBrowserNotification(`Invoice #${invoiceId} released`, {
    body: `Fully funded with ${fundedLabel} USDC.`,
    tag: `invoice-released-${invoiceId}`,
  });
}
