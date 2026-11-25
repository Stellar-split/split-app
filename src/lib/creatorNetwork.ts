export interface NetworkCreator {
  address: string;
  name: string;
  tags: string[];
}

export type ConnectionStatus = "none" | "pending" | "connected";

export interface NetworkState {
  connections: string[];
  pending: string[];
}

export const statusOf = (state: NetworkState, address: string): ConnectionStatus =>
  state.connections.includes(address) ? "connected" : state.pending.includes(address) ? "pending" : "none";

export function requestConnection(state: NetworkState, self: string, address: string): NetworkState {
  if (address === self || statusOf(state, address) !== "none") return state;
  return { ...state, pending: [...state.pending, address] };
}

export function acceptConnection(state: NetworkState, address: string): NetworkState {
  if (!state.pending.includes(address)) return state;
  return { connections: [...state.connections, address], pending: state.pending.filter((a) => a !== address) };
}

export function removeConnection(state: NetworkState, address: string): NetworkState {
  return { connections: state.connections.filter((a) => a !== address), pending: state.pending.filter((a) => a !== address) };
}

export function suggestCreators(
  me: NetworkCreator,
  candidates: NetworkCreator[],
  state: NetworkState,
  limit = 5,
): { creator: NetworkCreator; sharedTags: string[] }[] {
  const mine = new Set(me.tags.map((t) => t.toLowerCase()));
  return candidates
    .filter((c) => c.address !== me.address && statusOf(state, c.address) === "none")
    .map((creator) => ({ creator, sharedTags: creator.tags.filter((t) => mine.has(t.toLowerCase())) }))
    .filter((s) => s.sharedTags.length > 0)
    .sort((a, b) => b.sharedTags.length - a.sharedTags.length || a.creator.name.localeCompare(b.creator.name))
    .slice(0, limit);
}
