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

const REGISTRY_KEY = "stellarsplit_arbitrator_registry";
const DISPUTES_KEY = "stellarsplit_disputes";

const DEFAULT_ARBITRATORS: Arbitrator[] = [
  {
    id: "arb-stellar-mediate",
    name: "StellarMediate",
    address: "GSTELLARMEDIATEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    rating: 4.8,
    resolvedDisputeCount: 42,
  },
  {
    id: "arb-chain-resolve",
    name: "ChainResolve",
    address: "GCHAINRESOLVEXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    rating: 4.6,
    resolvedDisputeCount: 27,
  },
];

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // Access to localStorage may throw in restricted environments.
  }
  return null;
}

/** Normalizes a vote cast as either a number (1 = Release, 0 = Refund) or a string into its canonical outcome label. */
export function normalizeVote(vote: string | number): "Release" | "Refund" {
  if (typeof vote === "number") return vote === 1 ? "Release" : "Refund";
  return vote === "Release" ? "Release" : "Refund";
}

/** True when a dispute has reached a final outcome and is ready to be enforced on-chain. */
export function canEnforceResolution(data: DisputeRecord): boolean {
  return data.state === "Resolved" && data.outcome !== undefined;
}

/** True when every assigned arbitrator has cast a vote. */
export function isVotingComplete(data: DisputeRecord): boolean {
  if (!data || !Array.isArray(data.arbitrators) || data.arbitrators.length === 0) return false;
  const voters = new Set((data.votes ?? []).map((v) => v.arbitrator));
  return data.arbitrators.every((arb) => voters.has(arb));
}

export function getArbitrators(): Arbitrator[] {
  const storage = getStorage();
  if (!storage) return DEFAULT_ARBITRATORS.map((a) => ({ ...a }));
  try {
    const raw = storage.getItem(REGISTRY_KEY);
    if (!raw) return DEFAULT_ARBITRATORS.map((a) => ({ ...a }));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Arbitrator[];
    return DEFAULT_ARBITRATORS.map((a) => ({ ...a }));
  } catch {
    return DEFAULT_ARBITRATORS.map((a) => ({ ...a }));
  }
}

export function searchArbitrators(query: string): Arbitrator[] {
  const all = getArbitrators();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (a) =>
      a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q),
  );
}

export function getArbitratorByAddress(address: string): Arbitrator | undefined {
  return getArbitrators().find((a) => a.address === address);
}

function readDisputes(): DisputeRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(DISPUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DisputeRecord[]) : [];
  } catch {
    return [];
  }
}

function writeDisputes(disputes: DisputeRecord[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(DISPUTES_KEY, JSON.stringify(disputes));
  } catch {
    // Ignore quota / serialization errors.
  }
}

export function getDisputesByInvoice(invoiceId: string): DisputeRecord[] {
  return readDisputes().filter((d) => d.invoiceId === invoiceId);
}

export function createDispute(input: {
  invoiceId: string;
  initiator: string;
  respondent: string;
  reason?: string;
  description?: string;
  arbitrators?: string[];
}): DisputeRecord {
  const dispute: DisputeRecord = {
    id: `dispute_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    invoiceId: input.invoiceId,
    state: "Open",
    reason: input.reason,
    initiator: input.initiator,
    timestamp: Date.now(),
    description: input.description,
    arbitrators: input.arbitrators ?? [],
    votes: [],
    timeline: [
      {
        timestamp: Date.now(),
        description: input.reason ?? "Dispute opened",
        actor: input.initiator,
      },
    ],
    evidenceLinks: [],
  };

  const disputes = readDisputes();
  disputes.push(dispute);
  writeDisputes(disputes);
  return dispute;
}
