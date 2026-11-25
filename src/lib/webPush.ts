import type { StoredPushSubscription } from "./pushSubscriptionStore";
import { removeSubscriptionEverywhere } from "./pushSubscriptionStore";

export interface FundingMilestonePayload {
  invoiceId: string;
  milestone: number;
  invoiceTitle: string;
  remainingLabel: string;
}

export interface SubscriptionBillingPayload {
  subscriptionId: string;
  /** Short label for the subscription/plan, e.g. "Pro plan". */
  planName: string;
  /** Notification kind — drives the title/body copy. */
  kind: "billing" | "reminder" | "paused" | "resumed" | "cancelled";
  /** Human-readable amount, e.g. "$12.00". Optional for non-billing events. */
  amountLabel?: string;
  /** Human-readable due date, e.g. "Mar 1, 2025". Optional for non-billing events. */
  dueDateLabel?: string;
  /** Optional extra detail, e.g. a cancellation reason. */
  note?: string;
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

function subscriptionBillingCopy(payload: SubscriptionBillingPayload): {
  title: string;
  body: string;
} {
  switch (payload.kind) {
    case "billing":
      return {
        title: `${payload.planName} — payment received`,
        body: payload.amountLabel
          ? `We charged ${payload.amountLabel} for your ${payload.planName} subscription.`
          : `Your ${payload.planName} subscription was billed.`,
      };
    case "reminder":
      return {
        title: `${payload.planName} — upcoming charge`,
        body: payload.amountLabel
          ? `Your ${payload.planName} subscription renews for ${payload.amountLabel}${
              payload.dueDateLabel ? ` on ${payload.dueDateLabel}` : ""
            }.`
          : `Your ${payload.planName} subscription is due to renew${
              payload.dueDateLabel ? ` on ${payload.dueDateLabel}` : ""
            }.`,
      };
    case "paused":
      return {
        title: `${payload.planName} — subscription paused`,
        body: `Your ${payload.planName} subscription is paused and won't be billed until you resume it.`,
      };
    case "resumed":
      return {
        title: `${payload.planName} — subscription resumed`,
        body: `Your ${payload.planName} subscription is active again${
          payload.dueDateLabel ? ` and renews on ${payload.dueDateLabel}` : ""
        }.`,
      };
    case "cancelled":
      return {
        title: `${payload.planName} — subscription cancelled`,
        body: payload.note
          ? `Your ${payload.planName} subscription was cancelled. Reason: ${payload.note}`
          : `Your ${payload.planName} subscription was cancelled.`,
      };
  }
}

/**
 * Send a subscription billing/reminder/lifecycle push notification to a single
 * subscription. Mirrors sendFundingMilestoneNotification: returns false (without
 * throwing) when VAPID keys aren't configured, and prunes subscriptions that the
 * push service reports as gone (404/410).
 */
export async function sendSubscriptionBillingNotification(
  subscription: StoredPushSubscription,
  payload: SubscriptionBillingPayload
): Promise<boolean> {
  if (!vapidConfigured()) return false;
  await ensureConfigured();
  const webPush = await import("web-push");

  const { title, body } = subscriptionBillingCopy(payload);

  const message = JSON.stringify({
    title,
    body,
    subscriptionId: payload.subscriptionId,
    kind: payload.kind,
  });

  try {
    await webPush.default.sendNotification(subscription, message);
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      removeSubscriptionEverywhere(subscription.endpoint);
    }
    return false;
  }
}
