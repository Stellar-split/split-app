/**
 * API key management — localStorage-backed keys with read/write scopes.
 * Scope is encoded in the key prefix so server routes can enforce it
 * without a database lookup.
 */

export type ApiKeyScope = "read" | "write";

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  scope: ApiKeyScope;
  createdAt: number;
  lastUsed?: number | null;
}

export const STORAGE_KEY = "apiKeys";
export const BANNER_DISMISSED_KEY = "apiKeys_scopeMigrationBannerDismissed";

export interface LoadKeysResult {
  keys: ApiKey[];
  migratedLegacy: boolean;
}

export function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Derive scope from the key string for display and legacy migration. */
export function parseScopeFromKey(key: string): ApiKeyScope | null {
  if (!key.startsWith("sk_")) return null;
  if (key.startsWith("sk_read_")) return "read";
  if (key.startsWith("sk_write_")) return "write";
  // Legacy keys: sk_<uuid> without scope segment
  return "write";
}

export function generateKeyValue(scope: ApiKeyScope): string {
  const id = randomId();
  return scope === "read" ? `sk_read_${id}` : `sk_write_${id}`;
}

export function buildApiKey(params: {
  id: string;
  name: string;
  key: string;
  scope: ApiKeyScope;
  createdAt?: number;
}): ApiKey {
  return {
    id: params.id,
    name: params.name.trim(),
    key: params.key,
    scope: params.scope,
    createdAt: params.createdAt ?? Date.now(),
    lastUsed: null,
  };
}

function migrateRawKey(raw: Partial<ApiKey> & Pick<ApiKey, "id" | "name" | "key" | "createdAt">): {
  key: ApiKey;
  wasLegacy: boolean;
} {
  if (raw.scope === "read" || raw.scope === "write") {
    return { key: raw as ApiKey, wasLegacy: false };
  }
  return {
    key: { ...raw, scope: "write" },
    wasLegacy: true,
  };
}

export function loadKeys(): LoadKeysResult {
  if (typeof window === "undefined") return { keys: [], migratedLegacy: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { keys: [], migratedLegacy: false };
    const parsed = JSON.parse(raw) as Array<
      Partial<ApiKey> & Pick<ApiKey, "id" | "name" | "key" | "createdAt">
    >;
    let migratedLegacy = false;
    const keys = parsed.map((item) => {
      const { key, wasLegacy } = migrateRawKey(item);
      if (wasLegacy) migratedLegacy = true;
      return key;
    });
    return { keys, migratedLegacy };
  } catch {
    return { keys: [], migratedLegacy: false };
  }
}

export function saveKeys(keys: ApiKey[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function createApiKey(name: string, scope: ApiKeyScope): ApiKey {
  return buildApiKey({
    id: randomId(),
    name,
    key: generateKeyValue(scope),
    scope,
  });
}

export function isMigrationBannerDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
}

export function dismissMigrationBanner(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BANNER_DISMISSED_KEY, "1");
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export type ScopeCheckResult =
  | { ok: true; scope: ApiKeyScope }
  | { ok: false; status: 401 | 403; error: string };

export function checkWriteScope(
  token: string | null,
  verifier: (token: string) => ApiKeyScope | null = parseScopeFromKey
): ScopeCheckResult {
  if (!token) {
    return { ok: false, status: 401, error: "API key required. Provide Authorization: Bearer <key>." };
  }
  const scope = verifier(token);
  if (!scope) {
    return { ok: false, status: 401, error: "Invalid API key." };
  }
  if (scope === "read") {
    return {
      ok: false,
      status: 403,
      error: "This endpoint requires write scope. Your API key is read-only.",
    };
  }
  return { ok: true, scope };
}
