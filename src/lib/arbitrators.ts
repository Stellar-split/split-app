export interface Arbitrator {
  id: string;
  name: string;
  address: string;
  email?: string;
  rating?: number;
  resolvedDisputeCount?: number | null;
}

export interface DisputeVote {
  invoiceId?: string;
  arbitrator: string;
  vote: string | number;
  votedAt?: string;
}

export interface DisputeEvidenceLink {
  filename: string;
  cid: string;
  submitter: string;
  timestamp: number;
}

export interface DisputeTimelineEvent {
  timestamp: number;
  description: string;
  actor?: string;
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
  votes: DisputeVote[];
  timeline: DisputeTimelineEvent[];
  evidenceLinks: DisputeEvidenceLink[];
}

export type DisputeState = 'Open' | 'Evidence' | 'Voting' | 'Resolved' | 'Enforced';
export type DisputeOutcome = 'Release' | 'Refund' | 'Settled';

/** Normalize a vote value (string or numeric) to a dispute outcome. */
export function normalizeVote(vote: string | number): DisputeOutcome | null {
  if (vote === 1 || vote === '1' || vote === 'Release') return 'Release';
  if (vote === 0 || vote === '0' || vote === 'Refund') return 'Refund';
  if (vote === 'Settled') return 'Settled';
  return null;
}

/** True when every assigned arbitrator has cast a vote. */
export function isVotingComplete(data: DisputeRecord): boolean {
  if (!data || !Array.isArray(data.arbitrators) || data.arbitrators.length === 0) return false;
  const voters = new Set((data.votes ?? []).map((v) => v.arbitrator));
  return data.arbitrators.every((arb) => voters.has(arb));
}

/** True when voting is complete and the resolution has not been enforced yet. */
export function canEnforceResolution(data: DisputeRecord): boolean {
  return isVotingComplete(data) && data.state !== 'Enforced';
}

const REGISTRY_STORAGE_KEY = 'stellarsplit_arbitrator_registry';

const DEFAULT_ARBITRATORS: Arbitrator[] = [
  {
    id: 'stellar-mediate',
    name: 'StellarMediate',
    address: 'GSTELLARMEDIATEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    resolvedDisputeCount: 42,
  },
  {
    id: 'chain-resolve',
    name: 'ChainResolve',
    address: 'GCHAINRESOLVEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    resolvedDisputeCount: 17,
  },
  {
    id: 'trust-arbiter',
    name: 'TrustArbiter',
    address: 'GTRUSTARBITERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    resolvedDisputeCount: null,
  },
];

/** Read the arbitrator registry from localStorage, falling back to defaults. */
export function getArbitrators(): Arbitrator[] {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ARBITRATORS;
  try {
    const raw = window.localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return DEFAULT_ARBITRATORS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ARBITRATORS;
    return parsed as Arbitrator[];
  } catch {
    return DEFAULT_ARBITRATORS;
  }
}

/** Filter the registry by name or address (case-insensitive). */
export function searchArbitrators(query: string): Arbitrator[] {
  const all = getArbitrators();
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (arb) =>
      arb.name.toLowerCase().includes(q) || arb.address.toLowerCase().includes(q),
  );
}

/** Look up a single arbitrator by exact address. */
export function getArbitratorByAddress(address: string): Arbitrator | undefined {
  return getArbitrators().find((arb) => arb.address === address);
}
