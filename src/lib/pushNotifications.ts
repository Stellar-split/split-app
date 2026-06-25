/**
 * Browser push notifications for invoice events
 */

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    localStorage.setItem("push_subscribed", "true");
    return true;
  } catch {
    return false;
  }
}

export async function showInvoiceNotification(
  invoiceId: string,
  title: string,
  message: string
): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body: message,
      data: { invoiceId, url: `/invoice/${invoiceId}` },
    });
    return true;
  } catch {
    return false;
  }
}

export function isPushNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("push_subscribed") === "true";
}
