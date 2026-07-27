import type { StoredPushSubscription } from "./pushSubscriptionStore";
import { removeSubscriptionEverywhere } from "./pushSubscriptionStore";

export interface FundingMilestonePayload {
  invoiceId: string;
  milestone: number;
  invoiceTitle: string;
  remainingLabel: string;
}

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

let configured = false;
async function ensureConfigured() {
  if (configured || !vapidConfigured()) return;
  const webPush = await import("web-push");
  webPush.default.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@stellarsplit.example",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

/**
 * Send a funding-milestone push notification to a single subscription.
 * Returns false (without throwing) when VAPID keys aren't configured, so
 * local dev without push set up degrades gracefully instead of crashing.
 */
export async function sendFundingMilestoneNotification(
  subscription: StoredPushSubscription,
  payload: FundingMilestonePayload
): Promise<boolean> {
  if (!vapidConfigured()) return false;
  await ensureConfigured();
  const webPush = await import("web-push");

  const body = JSON.stringify({
    title: `${payload.invoiceTitle} — ${payload.milestone}% funded`,
    body:
      payload.milestone >= 100
        ? "Fully funded!"
        : `${payload.remainingLabel} remaining to reach 100%.`,
    invoiceId: payload.invoiceId,
    milestone: payload.milestone,
  });

  try {
    await webPush.default.sendNotification(subscription, body);
    return true;
  } catch (err) {
    // 404/410 means the subscription is gone (browser unsubscribed, permission
    // revoked, etc.) — stop tracking it instead of retrying forever.
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      removeSubscriptionEverywhere(subscription.endpoint);
    }
    return false;
  }
}
