export type InvoiceSectionFocus = 'details' | 'payments' | 'recipients';

export interface PresenceHeartbeat {
  userId: string;
  displayName: string;
  focusedSection: InvoiceSectionFocus;
  timestamp: number;
}

export interface CoCreatorPresence extends PresenceHeartbeat {
  avatarUrl?: string;
  lastSeen: number;
}

export interface PresenceRosterUpdate {
  active: CoCreatorPresence[];
  timestamp: number;
}
