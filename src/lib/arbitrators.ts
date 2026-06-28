export interface Arbitrator {
  address: string;
  name: string;
  resolvedDisputeCount: number | null;
}

const STORAGE_KEY = "stellarsplit_arbitrator_registry";

function getDefaultRegistry(): Arbitrator[] {
  return [
    {
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "StellarMediate",
      resolvedDisputeCount: 42,
    },
    {
      address: "GBBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "ChainResolve",
      resolvedDisputeCount: 17,
    },
    {
      address: "GBCCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "TrustArbitrators",
      resolvedDisputeCount: null,
    },
  ];
}

export function getArbitrators(): Arbitrator[] {
  if (typeof window === "undefined") return getDefaultRegistry();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultRegistry();
    const parsed = JSON.parse(raw) as Arbitrator[];
    return parsed.length > 0 ? parsed : getDefaultRegistry();
  } catch {
    return getDefaultRegistry();
  }
}

export function searchArbitrators(query: string): Arbitrator[] {
  const q = query.trim().toLowerCase();
  if (!q) return getArbitrators();
  return getArbitrators().filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q),
  );
}

export function getArbitratorByAddress(address: string): Arbitrator | undefined {
  return getArbitrators().find((a) => a.address === address);
}
