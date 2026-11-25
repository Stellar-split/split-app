/**
 * folders — named invoice groups (collections).
 *
 * Invoices are on-chain and have no room for user metadata, so folders and
 * their membership are kept off-chain keyed by folder/invoice id — the same
 * approach `invoiceTags.ts` uses for tags.
 */
import { z } from "zod";

export const MAX_FOLDER_NAME_LENGTH = 60;
export const MAX_FOLDERS = 200;

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export function normalizeFolderName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_FOLDER_NAME_LENGTH);
}

export const FolderNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(MAX_FOLDER_NAME_LENGTH, "Name is too long"),
});

export const FolderMembershipSchema = z.object({
  folderIds: z.array(z.string()).max(MAX_FOLDERS),
});

export type FolderNamePayload = z.infer<typeof FolderNameSchema>;
export type FolderMembershipPayload = z.infer<typeof FolderMembershipSchema>;

// ── Storage ────────────────────────────────────────────────────────────────
// In-memory for now, matching the existing tag/splitMeta stores. Swapping
// this for a database only requires reimplementing the functions below.

const foldersById = new Map<string, Folder>();
/** invoiceId → set of folder ids it belongs to. */
const membership = new Map<string, Set<string>>();
let nextId = 1;

export function listFolders(): Folder[] {
  return Array.from(foldersById.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export function getFolder(id: string): Folder | undefined {
  return foldersById.get(id);
}

export function createFolder(name: string): Folder {
  const normalized = normalizeFolderName(name);
  const folder: Folder = { id: String(nextId++), name: normalized, createdAt: Date.now() };
  foldersById.set(folder.id, folder);
  return folder;
}

export function renameFolder(id: string, name: string): Folder | undefined {
  const folder = foldersById.get(id);
  if (!folder) return undefined;
  folder.name = normalizeFolderName(name);
  return folder;
}

export function deleteFolder(id: string): boolean {
  if (!foldersById.delete(id)) return false;
  for (const ids of Array.from(membership.values())) {
    ids.delete(id);
  }
  return true;
}

/** Every folder id a given invoice belongs to. */
export function getFoldersForInvoice(invoiceId: string): string[] {
  return Array.from(membership.get(invoiceId) ?? []);
}

/** Replace the full set of folders an invoice belongs to. */
export function setFoldersForInvoice(invoiceId: string, folderIds: readonly string[]): string[] {
  const valid = folderIds.filter((id) => foldersById.has(id));
  if (valid.length === 0) {
    membership.delete(invoiceId);
  } else {
    membership.set(invoiceId, new Set(valid));
  }
  return valid;
}

/** Map of invoiceId → folder ids, for filtering an invoice list in one round trip. */
export function getMembershipMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [invoiceId, ids] of Array.from(membership.entries())) {
    out[invoiceId] = Array.from(ids);
  }
  return out;
}

/** Every invoice id currently assigned to a folder. */
export function getInvoiceIdsInFolder(folderId: string): string[] {
  const out: string[] = [];
  for (const [invoiceId, ids] of Array.from(membership.entries())) {
    if (ids.has(folderId)) out.push(invoiceId);
  }
  return out;
}

/** Test seam — clears all stored folders and membership. */
export function __resetFolderStore(): void {
  foldersById.clear();
  membership.clear();
  nextId = 1;
}
