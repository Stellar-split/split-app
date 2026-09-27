export type ShareRole = "owner" | "editor" | "commenter" | "viewer";

export type SharePermission =
  | "view"
  | "comment"
  | "edit"
  | "cancel"
  | "manageAccess";

export interface ShareGrant {
  /** Stellar address of the collaborator. */
  address: string;
  role: ShareRole;
  /** Optional per-grant overrides that add or remove permissions from the role. */
  allow?: SharePermission[];
  deny?: SharePermission[];
  /** Unix ms expiry; access is revoked after this time. */
  expiresAt?: number;
  grantedAt: number;
}

export const ROLE_PERMISSIONS: Record<ShareRole, SharePermission[]> = {
  owner: ["view", "comment", "edit", "cancel", "manageAccess"],
  editor: ["view", "comment", "edit"],
  commenter: ["view", "comment"],
  viewer: ["view"],
};

export const ROLE_RANK: Record<ShareRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export function isExpired(grant: ShareGrant, now = Date.now()): boolean {
  return grant.expiresAt !== undefined && grant.expiresAt <= now;
}

/** Resolve the effective permissions for a grant (role + allow − deny). Expired grants have none. */
export function effectivePermissions(grant: ShareGrant, now = Date.now()): Set<SharePermission> {
  if (isExpired(grant, now)) return new Set();
  const perms = new Set<SharePermission>([...ROLE_PERMISSIONS[grant.role], ...(grant.allow ?? [])]);
  for (const p of grant.deny ?? []) perms.delete(p);
  return perms;
}

export function can(
  grants: ShareGrant[],
  address: string,
  permission: SharePermission,
  now = Date.now()
): boolean {
  const grant = grants.find((g) => g.address === address);
  return grant ? effectivePermissions(grant, now).has(permission) : false;
}

/**
 * Add or update a grant. Only actors with `manageAccess` may change grants, and
 * nobody may assign a role above their own or modify the owner's grant.
 */
export function upsertGrant(
  grants: ShareGrant[],
  actor: string,
  next: Omit<ShareGrant, "grantedAt">,
  now = Date.now()
): ShareGrant[] {
  const actorGrant = grants.find((g) => g.address === actor);
  if (!actorGrant || !can(grants, actor, "manageAccess", now)) {
    throw new Error("You do not have permission to manage access.");
  }
  if (ROLE_RANK[next.role] > ROLE_RANK[actorGrant.role]) {
    throw new Error("Cannot grant a role higher than your own.");
  }
  const existing = grants.find((g) => g.address === next.address);
  if (existing?.role === "owner" && next.address !== actor) {
    throw new Error("The owner's access cannot be changed.");
  }
  const grant: ShareGrant = { ...next, grantedAt: existing?.grantedAt ?? now };
  return existing
    ? grants.map((g) => (g.address === next.address ? grant : g))
    : [...grants, grant];
}

export function revokeGrant(
  grants: ShareGrant[],
  actor: string,
  address: string,
  now = Date.now()
): ShareGrant[] {
  if (!can(grants, actor, "manageAccess", now)) {
    throw new Error("You do not have permission to manage access.");
  }
  if (grants.find((g) => g.address === address)?.role === "owner") {
    throw new Error("The owner's access cannot be revoked.");
  }
  return grants.filter((g) => g.address !== address);
}

const storageKey = (resourceId: string) => `split:share-grants:${resourceId}`;

export function loadGrants(resourceId: string): ShareGrant[] {
  try {
    const raw = localStorage.getItem(storageKey(resourceId));
    return raw ? (JSON.parse(raw) as ShareGrant[]) : [];
  } catch {
    return [];
  }
}

export function saveGrants(resourceId: string, grants: ShareGrant[]): void {
  try {
    localStorage.setItem(storageKey(resourceId), JSON.stringify(grants));
  } catch {
    // storage unavailable; grants stay in memory only
  }
}
