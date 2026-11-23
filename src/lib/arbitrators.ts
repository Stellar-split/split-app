export interface Arbitrator {
  id: string;
  name: string;
  address: string;
  email?: string;
  rating?: number;
  resolvedDisputeCount?: number | null;
}

export interface DisputeRecord {
  id: string;
  invoiceId: string;
  state: DisputeState;
  outcome?: DisputeOutcome;
  reason?: string;
  initiator: string;
  timestamp: number;
  description?: string;
  arbitrators: string[];
  votes: Array<{ invoiceId: string; arbitrator: string; vote: string | number }>;
  timeline: Array<{ timestamp: number; description: string; actor?: string }>;
  evidenceLinks: Array<{ filename: string; cid: string; submitter: string; timestamp: number }>;
}

export type DisputeState = 'Open' | 'Evidence' | 'Voting' | 'Resolved' | 'Enforced';
export type DisputeOutcome = 'Release' | 'Refund' | 'Settled';

export function isVotingComplete(data: any): boolean {
  return false;
}

export function canEnforceResolution(data: any): boolean {
  return false;
}

export function searchArbitrators(query: string): any[] {
  return [];
}

export function getArbitrators(): Arbitrator[] {
  return [];
}
