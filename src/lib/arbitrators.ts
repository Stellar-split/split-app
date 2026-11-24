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

export const ARBITRATOR_REGISTRY_KEY = "stellarsplit_arbitrator_registry";

/** Default arbitrator registry used when no valid registry is stored. */
export const DEFAULT_ARBITRATORS: Arbitrator[] = [
  {
    id: "stellar-mediate",
    name: "StellarMediate",
    address: "GSTELLARMEDIATEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    rating: 4.8,
    resolvedDisputeCount: 128,
  },
  {
    id: "chain-resolve",
    name: "ChainResolve",
    address: "GCHAINRESOLVEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    rating: 4.6,
    resolvedDisputeCount: 74,
  },
  {
    id: "lumen-arbitration",
    name: "LumenArbitration",
    address: "GLUMENARBITRATIONXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    rating: 4.4,
    resolvedDisputeCount: 41,
  },
];

/** Returns a fresh copy of the default registry. */
function getDefaultArbitrators(): Arbitrator[] {
  return DEFAULT_ARBITRATORS.map((arb) => ({ ...arb }));
}

/** Reads the arbitrator registry from localStorage, falling back to defaults. */
export function getArbitrators(): Arbitrator[] {
  if (typeof localStorage === "undefined") return getDefaultArbitrators();

  try {
    const raw = localStorage.getItem(ARBITRATOR_REGISTRY_KEY);
    if (!raw) return getDefaultArbitrators();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultArbitrators();

    const valid = parsed.filter(
      (entry): entry is Arbitrator =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Arbitrator).address === "string" &&
        typeof (entry as Arbitrator).name === "string"
    );

    return valid.length > 0 ? valid : getDefaultArbitrators();
  } catch {
    return getDefaultArbitrators();
  }
}

/** Persists the arbitrator registry to localStorage. */
export function saveArbitrators(arbitrators: Arbitrator[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ARBITRATOR_REGISTRY_KEY, JSON.stringify(arbitrators));
  } catch {
    // Ignore storage failures (quota, private mode, etc.)
  }
}

/** Filters arbitrators by case-insensitive name or address substring. */
export function searchArbitrators(query: string): Arbitrator[] {
  const all = getArbitrators();
  const term = query.trim().toLowerCase();
  if (!term) return all;

  return all.filter(
    (arb) =>
      arb.name.toLowerCase().includes(term) ||
      arb.address.toLowerCase().includes(term)
  );
}

/** Returns the arbitrator matching the given address, if any. */
export function getArbitratorByAddress(address: string): Arbitrator | undefined {
  return getArbitrators().find((arb) => arb.address === address);
}
