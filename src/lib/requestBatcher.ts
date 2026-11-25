/**
 * Request batching utility (addresses #916 "Add API response compression
 * and request batching").
 *
 * Collapses many small calls issued within the same tick/window into a
 * single network request, reducing request count and connection overhead
 * for chatty UI code (e.g. fetching several records by id in a list view).
 *
 * Usage:
 *   const fetchUser = createBatcher<string, User>(async (ids) => {
 *     const res = await apiFetch(`/api/users/batch?ids=${ids.join(",")}`);
 *     const users: User[] = await res.json();
 *     return new Map(users.map((u) => [u.id, u]));
 *   });
 *
 *   const [a, b] = await Promise.all([fetchUser("1"), fetchUser("2")]);
 *   // -> both resolved by a single /api/users/batch request.
 */

export type BatchLoader<K, V> = (keys: K[]) => Promise<Map<K, V>>;

export interface BatcherOptions {
  /** Window (ms) to collect keys before flushing a batch. Default 10ms. */
  windowMs?: number;
  /** Maximum keys per batch request before an early flush. Default 50. */
  maxBatchSize?: number;
}

export function createBatcher<K, V>(
  loader: BatchLoader<K, V>,
  options: BatcherOptions = {}
) {
  const windowMs = options.windowMs ?? 10;
  const maxBatchSize = options.maxBatchSize ?? 50;

  let pendingKeys: K[] = [];
  let pendingResolvers: Array<{
    key: K;
    resolve: (value: V) => void;
    reject: (err: unknown) => void;
  }> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush() {
    const keys = pendingKeys;
    const resolvers = pendingResolvers;
    pendingKeys = [];
    pendingResolvers = [];
    timer = null;

    try {
      const results = await loader(keys);
      for (const { key, resolve, reject } of resolvers) {
        if (results.has(key)) {
          resolve(results.get(key) as V);
        } else {
          reject(new Error(`Batch loader did not return a result for key: ${String(key)}`));
        }
      }
    } catch (err) {
      for (const { reject } of resolvers) {
        reject(err);
      }
    }
  }

  return function load(key: K): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      pendingKeys.push(key);
      pendingResolvers.push({ key, resolve, reject });

      if (pendingKeys.length >= maxBatchSize) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void flush();
        return;
      }

      if (!timer) {
        timer = setTimeout(() => {
          void flush();
        }, windowMs);
      }
    });
  };
}
