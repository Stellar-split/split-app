/**
 * IndexedDB-backed storage for invoice drafts, so in-progress form state
 * survives a dropped connection or a closed tab. Keyed as
 * `draft-[userId]-[draftId]` so multiple tabs editing different invoices
 * (same user) never collide.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface RecipientRowData {
  address: string;
  amount: string;
}

export interface DraftFormData {
  recipients: RecipientRowData[];
  token: string;
  deadlineDays: number;
  recurring: boolean;
  intervalDays: 7 | 30;
}

export interface StoredDraft {
  key: string;
  userId: string;
  draftId: string;
  data: DraftFormData;
  updatedAt: number;
}

interface DraftsDBSchema extends DBSchema {
  drafts: {
    key: string;
    value: StoredDraft;
    indexes: { "by-userId": string };
  };
}

const DB_NAME = "stellarsplit-drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DraftsDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<DraftsDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DraftsDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("by-userId", "userId");
        }
      },
    });
  }
  return dbPromise;
}

export function draftKey(userId: string, draftId: string): string {
  return `draft-${userId}-${draftId}`;
}

const LOCAL_USER_ID_KEY = "stellarsplit_local_user_id";

/** Stable per-browser id used as the draft owner before a wallet connects. */
export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = `local-${crypto.randomUUID()}`;
    localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return id;
}

export async function putDraft(userId: string, draftId: string, data: DraftFormData): Promise<void> {
  const db = await getDB();
  const draft: StoredDraft = { key: draftKey(userId, draftId), userId, draftId, data, updatedAt: Date.now() };
  await db.put(STORE_NAME, draft);
}

export async function getDraft(userId: string, draftId: string): Promise<StoredDraft | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, draftKey(userId, draftId));
}

export async function deleteDraft(userId: string, draftId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, draftKey(userId, draftId));
}

/** All drafts for a user, most recently updated first. */
export async function listDraftsForUser(userId: string): Promise<StoredDraft[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_NAME, "by-userId", userId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Test-only: drop and recreate the database so tests don't leak state. */
export async function __resetOfflineDraftDBForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
