export interface SyncPayload {
  id: string;
  type: 'payment' | 'invoice' | 'split';
  data: unknown;
  timestamp: number;
  status: 'pending' | 'synced' | 'conflict';
  retries: number;
}

export interface SyncConflict {
  localVersion: SyncPayload;
  remoteVersion: SyncPayload;
  resolution: 'local' | 'remote' | 'merge';
}

export class OfflineSyncEngine {
  private db: IDBDatabase | null = null;
  private pendingQueue: Map<string, SyncPayload> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();

  async initialize(): Promise<void> {
    this.db = await this.openDatabase();
    await this.loadPendingFromStorage();
  }

  async addPending(payload: SyncPayload): Promise<void> {
    payload.status = 'pending';
    payload.retries = 0;
    this.pendingQueue.set(payload.id, payload);
    await this.savePending(payload);
  }

  async sync(): Promise<{ synced: number; conflicts: number }> {
    let synced = 0;
    let conflicts = 0;

    for (const [id, payload] of this.pendingQueue) {
      try {
        const response = await this.uploadPayload(payload);

        if (response.conflict) {
          this.handleConflict(payload, response.remote);
          conflicts++;
        } else {
          payload.status = 'synced';
          this.pendingQueue.delete(id);
          await this.deletePending(id);
          synced++;
        }
      } catch (error) {
        payload.retries++;
        if (payload.retries > 3) {
          payload.status = 'pending';
        }
      }
    }

    return { synced, conflicts };
  }

  resolveConflict(id: string, resolution: 'local' | 'remote' | 'merge'): void {
    const conflict = this.conflicts.get(id);
    if (!conflict) return;

    let resolved = conflict.localVersion;
    if (resolution === 'remote') {
      resolved = conflict.remoteVersion;
    } else if (resolution === 'merge') {
      resolved = this.mergePayloads(conflict.localVersion, conflict.remoteVersion);
    }

    resolved.status = 'pending';
    this.pendingQueue.set(id, resolved);
    this.conflicts.delete(id);
  }

  getPending(): SyncPayload[] {
    return Array.from(this.pendingQueue.values());
  }

  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }

  private async uploadPayload(payload: SyncPayload): Promise<any> {
    const endpoint = `/api/v1/${payload.type}s`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  private handleConflict(local: SyncPayload, remote: SyncPayload): void {
    this.conflicts.set(local.id, {
      localVersion: local,
      remoteVersion: remote,
      resolution: 'local',
    });
  }

  private mergePayloads(local: SyncPayload, remote: SyncPayload): SyncPayload {
    return {
      ...local,
      data: {
        ...remote.data,
        ...local.data,
      },
      timestamp: Math.max(local.timestamp, remote.timestamp),
    };
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('StellarSplitSync', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('syncPayloads')) {
          db.createObjectStore('syncPayloads', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadPendingFromStorage(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncPayloads'], 'readonly');
    const store = transaction.objectStore('syncPayloads');

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const payloads = request.result as SyncPayload[];
        payloads.forEach((p) => this.pendingQueue.set(p.id, p));
        resolve();
      };
    });
  }

  private async savePending(payload: SyncPayload): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncPayloads'], 'readwrite');
    const store = transaction.objectStore('syncPayloads');

    return new Promise((resolve) => {
      const request = store.put(payload);
      request.onsuccess = () => resolve();
    });
  }

  private async deletePending(id: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncPayloads'], 'readwrite');
    const store = transaction.objectStore('syncPayloads');

    return new Promise((resolve) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
    });
  }
}
