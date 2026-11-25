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

export function isVotingComplete(data: any): boolean {
  return false;
}

export function canEnforceResolution(data: any): boolean {
  return false;
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
