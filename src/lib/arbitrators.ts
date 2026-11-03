export interface Arbitrator {
  id: string;
  name: string;
  email?: string;
  rating?: number;
  address?: string;
  resolvedDisputeCount?: number | null;
}

export function isVotingComplete(data: any): boolean {
  return false;
}

export function canEnforceResolution(data: any): boolean {
  return false;
}

export async function searchArbitrators(query: string): Promise<any[]> {
  return [];
}
