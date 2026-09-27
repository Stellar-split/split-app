"use client";

import { useEffect, useState } from "react";
import {
  ROLE_PERMISSIONS,
  ROLE_RANK,
  effectivePermissions,
  isExpired,
  loadGrants,
  revokeGrant,
  saveGrants,
  upsertGrant,
  type SharePermission,
  type ShareGrant,
  type ShareRole,
} from "@/lib/sharePermissions";

interface Props {
  resourceId: string;
  /** Address of the current user. Seeded as owner when no grants exist yet. */
  currentAddress: string;
}

const ROLES: ShareRole[] = ["viewer", "commenter", "editor", "owner"];
const PERMISSIONS: SharePermission[] = ["view", "comment", "edit", "cancel", "manageAccess"];
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function SharePermissionsPanel({ resourceId, currentAddress }: Props) {
  const [grants, setGrants] = useState<ShareGrant[]>([]);
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [expiryDays, setExpiryDays] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadGrants(resourceId);
    setGrants(
      stored.length > 0
        ? stored
        : [{ address: currentAddress, role: "owner", grantedAt: Date.now() }]
    );
  }, [resourceId, currentAddress]);

  const apply = (fn: () => ShareGrant[]) => {
    try {
      const next = fn();
      setGrants(next);
      saveGrants(resourceId, next);
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  const actorRole = grants.find((g) => g.address === currentAddress)?.role;
  const canManage = grants.some(
    (g) => g.address === currentAddress && effectivePermissions(g).has("manageAccess")
  );
  const assignable = ROLES.filter((r) => actorRole && ROLE_RANK[r] <= ROLE_RANK[actorRole]);

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = address.trim();
    if (!STELLAR_ADDRESS.test(addr)) {
      setError("Enter a valid Stellar address.");
      return;
    }
    const days = Number(expiryDays);
    const expiresAt = expiryDays && days > 0 ? Date.now() + days * 86_400_000 : undefined;
    if (apply(() => upsertGrant(grants, currentAddress, { address: addr, role, expiresAt }))) {
      setAddress("");
      setExpiryDays("");
    }
  };

  const toggleOverride = (grant: ShareGrant, perm: SharePermission) => {
    const inRole = ROLE_PERMISSIONS[grant.role].includes(perm);
    const has = effectivePermissions(grant).has(perm);
    const allow = new Set(grant.allow ?? []);
    const deny = new Set(grant.deny ?? []);
    if (has) {
      allow.delete(perm);
      if (inRole) deny.add(perm);
    } else {
      deny.delete(perm);
      if (!inRole) allow.add(perm);
    }
    apply(() =>
      upsertGrant(grants, currentAddress, { ...grant, allow: [...allow], deny: [...deny] })
    );
  };

  return (
    <section aria-labelledby="share-perms-heading" className="bg-gray-900 rounded-xl p-4 sm:p-5">
      <h2 id="share-perms-heading" className="text-lg font-semibold mb-4">
        Shared access
      </h2>

      {error && (
        <p role="alert" className="text-red-400 text-sm mb-3">
          {error}
        </p>
      )}

      {canManage && (
        <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2 mb-5">
          <label className="sr-only" htmlFor="share-address">Collaborator address</label>
          <input
            id="share-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="G… collaborator address"
            className="flex-1 min-w-0 rounded-md bg-gray-800 px-3 py-2 text-sm"
          />
          <label className="sr-only" htmlFor="share-role">Role</label>
          <select
            id="share-role"
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm"
          >
            {assignable.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="share-expiry">Expires in days</label>
          <input
            id="share-expiry"
            type="number"
            min={1}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            placeholder="Expires (days)"
            className="sm:w-32 rounded-md bg-gray-800 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium">
            Share
          </button>
        </form>
      )}

      <ul className="space-y-3">
        {grants.map((grant) => {
          const perms = effectivePermissions(grant);
          const locked = !canManage || grant.role === "owner";
          return (
            <li key={grant.address} className="rounded-lg bg-gray-800 p-3" data-testid="share-grant">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm" title={grant.address}>
                  {short(grant.address)}
                  {grant.address === currentAddress && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                </span>
                <div className="flex items-center gap-2">
                  {isExpired(grant) ? (
                    <span className="text-xs text-red-300">Expired</span>
                  ) : grant.expiresAt ? (
                    <span className="text-xs text-gray-400">
                      Until {new Date(grant.expiresAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {locked ? (
                    <span className="text-xs rounded bg-gray-700 px-2 py-0.5">{grant.role}</span>
                  ) : (
                    <select
                      aria-label={`Role for ${short(grant.address)}`}
                      value={grant.role}
                      onChange={(e) =>
                        apply(() =>
                          upsertGrant(grants, currentAddress, {
                            ...grant,
                            role: e.target.value as ShareRole,
                            allow: [],
                            deny: [],
                          })
                        )
                      }
                      className="rounded bg-gray-700 px-2 py-0.5 text-xs"
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => apply(() => revokeGrant(grants, currentAddress, grant.address))}
                      className="text-xs text-red-300 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PERMISSIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={locked}
                    aria-pressed={perms.has(p)}
                    onClick={() => toggleOverride(grant, p)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      perms.has(p) ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-700 text-gray-500"
                    } disabled:cursor-default`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
