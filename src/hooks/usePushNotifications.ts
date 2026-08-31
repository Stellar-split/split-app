"use client";

import { useCallback, useEffect, useState } from "react";

export type PushNotificationStatus = "unsupported" | "off" | "denied" | "active";

export type PushNotificationPermissionStatus = "granted" | "denied" | "default";

export interface UsePushNotificationsResult {
  status: PushNotificationStatus;
  permissionStatus: PushNotificationPermissionStatus;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * usePushNotifications — subscribes the current browser to Web Push
 * notifications for a single invoice's funding milestones.
 */
export function usePushNotifications(invoiceId: string): UsePushNotificationsResult {
  const [status, setStatus] = useState<PushNotificationStatus>("off");
  const [permissionStatus, setPermissionStatus] = useState<PushNotificationPermissionStatus>(
    isSupported() ? Notification.permission : "default"
  );

  const refreshStatus = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    setPermissionStatus(Notification.permission);
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "active" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, invoiceId]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported()) return false;

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "off");
      return false;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, subscription: subscription.toJSON() }),
    });

    setStatus("active");
    return true;
  }, [invoiceId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setStatus("off");
  }, [invoiceId]);

  return { status, permissionStatus, subscribe, unsubscribe };
}
