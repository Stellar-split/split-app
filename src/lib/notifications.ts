export function notifySubscriptionResumed(id: string): void {}

export function notifySubscriptionModified(id: string): void {}

export function notifySubscriptionPaused(id: string): void {}

export function notifySubscriptionCancelled(id: string): void {}

export function addNotification(notification: any): void {}

export function sendPushNotification(title: string, options: any): void {}

export function parseMentions(text: string): string[] {
  return [];
}

export function notifyMention(userId: string, message: string): void {}
