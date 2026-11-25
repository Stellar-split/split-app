"use client";

import { useState } from "react";
import {
  removeConnection,
  requestConnection,
  statusOf,
  suggestCreators,
  type NetworkCreator,
  type NetworkState,
} from "@/lib/creatorNetwork";

export default function CreatorNetwork({
  me,
  creators,
  initial = { connections: [], pending: [] },
}: {
  me: NetworkCreator;
  creators: NetworkCreator[];
  initial?: NetworkState;
}) {
  const [state, setState] = useState<NetworkState>(initial);
  const suggestions = suggestCreators(me, creators, state);
  const connected = creators.filter((c) => statusOf(state, c.address) === "connected");
  const pending = creators.filter((c) => statusOf(state, c.address) === "pending");

  return (
    <section className="grid gap-6 md:grid-cols-2" aria-label="Creator network">
      <div>
        <h2 className="mb-2 font-semibold">Suggested creators</h2>
        {suggestions.length === 0 && <p className="text-sm text-gray-500">No suggestions right now.</p>}
        <ul className="space-y-2">
          {suggestions.map(({ creator, sharedTags }) => (
            <li key={creator.address} className="flex items-center justify-between gap-2 rounded border p-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{creator.name}</div>
                <div className="truncate text-xs text-gray-500">{sharedTags.join(", ")}</div>
              </div>
              <button
                type="button"
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setState(requestConnection(state, me.address, creator.address))}
              >
                Connect
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div>
          <h2 className="mb-2 font-semibold">Connections ({connected.length})</h2>
          <ul className="space-y-2">
            {connected.map((c) => (
              <li key={c.address} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                <span className="truncate">{c.name}</span>
                <button type="button" className="text-red-600" onClick={() => setState(removeConnection(state, c.address))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Pending ({pending.length})</h2>
          <ul className="space-y-2">
            {pending.map((c) => (
              <li key={c.address} className="rounded border p-2 text-sm">
                {c.name} <span className="text-xs text-gray-500">awaiting response</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
