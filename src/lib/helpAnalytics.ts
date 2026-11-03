export type HelpEventName = 'help_opened' | 'help_closed' | 'help_link_clicked';

export interface HelpEventPayload {
  helpKey: string;
  [key: string]: unknown;
}

export type HelpEventTransport = (eventName: HelpEventName, payload: HelpEventPayload) => void;

let transport: HelpEventTransport | null = null;

export function setHelpAnalyticsTransport(next: HelpEventTransport | null): void {
  transport = next;
}

export function trackHelpEvent(eventName: HelpEventName, payload: HelpEventPayload): void {
  if (!transport) {
    return;
  }
  try {
    transport(eventName, payload);
  } catch {
    // Analytics must never break the UI.
  }
}
