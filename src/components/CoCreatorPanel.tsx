"use client";

import { useState, useEffect } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

export type PermissionLevel = "view" | "edit" | "admin";

export interface CoCreatorEntry {
  address: string;
  permissionLevel: PermissionLevel;
}

const STORAGE_KEY_PREFIX = "coCreatorPermissions:";

function storageKey(invoiceId: string): string {
  return `${STORAGE_KEY_PREFIX}${invoiceId}`;
}

export function loadPermissions(invoiceId: string): CoCreatorEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(invoiceId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePermissions(invoiceId: string, entries: CoCreatorEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(invoiceId), JSON.stringify(entries));
}

function getPermission(entries: CoCreatorEntry[], address: string): PermissionLevel | null {
  return entries.find((e) => e.address === address)?.permissionLevel ?? null;
}

type InvoiceWithCoCreators = Invoice & { coCreators?: string[] };

interface Props {
  invoice: InvoiceWithCoCreators;
  publicKey: string;
  onUpdate: () => Promise<void>;
}

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export default function CoCreatorPanel({ invoice, publicKey, onUpdate }: Props) {
  const [newAddress, setNewAddress] = useState("");
  const [newPermission, setNewPermission] = useState<PermissionLevel>("view");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<CoCreatorEntry[]>([]);

  useEffect(() => {
    setPermissions(loadPermissions(invoice.id));
  }, [invoice.id]);

  const isCreator = publicKey === invoice.creator;
  const myPermission: PermissionLevel | "creator" = isCreator
    ? "creator"
    : getPermission(permissions, publicKey) ?? "view";

  const canManageCoCreators = isCreator || myPermission === "admin";
  const canEdit = isCreator || myPermission === "admin" || myPermission === "edit";

  const isCoCreator =
    isCreator || (invoice.coCreators ?? []).includes(publicKey);

  if (!isCoCreator) {
    return null;
  }

  const updatePermissionLevel = (address: string, level: PermissionLevel) => {
    if (!canManageCoCreators) return;
    const updated = permissions.filter((e) => e.address !== address);
    updated.push({ address, permissionLevel: level });
    setPermissions(updated);
    savePermissions(invoice.id, updated);
  };

  const handleAddCoCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canManageCoCreators) {
      setError("You don't have permission to manage co-creators");
      return;
    }

    if (!newAddress.trim()) {
      setError("Please enter an address");
      return;
    }

    if (!isValidStellarAddress(newAddress)) {
      setError("Invalid Stellar address format");
      return;
    }

    setLoading(true);
    try {
      await (splitClient as any).addCoCreator(invoice.id, newAddress);
      const updated = [
        ...permissions.filter((e) => e.address !== newAddress),
        { address: newAddress, permissionLevel: newPermission },
      ];
      setPermissions(updated);
      savePermissions(invoice.id, updated);
      setSuccess(`Added ${truncateAddress(newAddress)} as co-creator (${newPermission})`);
      setNewAddress("");
      setNewPermission("view");
      await onUpdate();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoCreator = async (address: string) => {
    if (!canManageCoCreators) {
      setError("You don't have permission to manage co-creators");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await (splitClient as any).removeCoCreator(invoice.id, address);
      const updated = permissions.filter((e) => e.address !== address);
      setPermissions(updated);
      savePermissions(invoice.id, updated);
      setSuccess(`Removed ${truncateAddress(address)} as co-creator`);
      await onUpdate();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-8 border border-gray-700 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Co-Creators</h2>
      <p className="text-xs text-gray-500 mb-4">
        Permission enforcement is client-side only, not a contract-level guarantee.
      </p>

      {invoice.coCreators && invoice.coCreators.length > 0 ? (
        <ul className="flex flex-col gap-2 mb-4">
          {invoice.coCreators.map((address: string) => {
            const level = getPermission(permissions, address) ?? "view";
            return (
              <li
                key={address}
                className="flex items-center justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm"
              >
                <span className="font-mono text-gray-300 truncate" title={address}>
                  {address}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {canManageCoCreators ? (
                    <select
                      value={level}
                      onChange={(e) =>
                        updatePermissionLevel(address, e.target.value as PermissionLevel)
                      }
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs"
                      aria-label={`Permission level for ${truncateAddress(address)}`}
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs text-gray-400 capitalize px-2 py-1 bg-gray-800 rounded">
                      {level}
                    </span>
                  )}
                  {canManageCoCreators && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCoCreator(address)}
                      disabled={loading}
                      className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 mb-4">No co-creators yet.</p>
      )}

      {canManageCoCreators && (
        <form onSubmit={handleAddCoCreator} className="flex flex-col gap-3">
          <div>
            <label htmlFor="co-creator-address" className="block text-sm font-medium text-gray-300 mb-1">
              Add Co-Creator
            </label>
            <input
              id="co-creator-address"
              type="text"
              placeholder="Stellar address (G...)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              disabled={loading}
              className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="co-creator-permission" className="block text-sm font-medium text-gray-300 mb-1">
              Permission Level
            </label>
            <select
              id="co-creator-permission"
              value={newPermission}
              onChange={(e) => setNewPermission(e.target.value as PermissionLevel)}
              disabled={loading}
              className="w-full sm:w-40 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add Co-Creator"}
          </button>
        </form>
      )}

      {!canManageCoCreators && (
        <>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}
          {!canEdit && (
            <p className="text-sm text-gray-500 mt-2">
              You have view-only access to this invoice.
            </p>
          )}
        </>
      )}
    </section>
  );
}
