"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { truncateAddress } from "@stellar-split/sdk";
import { getAdmin, getPendingAdmin, getAdminTimelock, proposeAdmin, confirmAdmin } from "@/lib/adminRotation";

const TIMELOCK_SECONDS = 86400; // 24 hours

export default function AdminSettingsPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<{
    newAdmin: string;
    proposedAt: number;
  } | null>(null);
  const [timelock, setTimelock] = useState(TIMELOCK_SECONDS);
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pk = await getFreighterPublicKey();
      setPublicKey(pk);

      const [admin, pending, tl] = await Promise.all([
        getAdmin(),
        getPendingAdmin(),
        getAdminTimelock(),
      ]);
      setCurrentAdmin(admin);
      setPendingProposal(pending);
      setTimelock(tl);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isAdmin = publicKey && currentAdmin && publicKey === currentAdmin;
  const isNominated =
    publicKey && pendingProposal && publicKey === pendingProposal.newAdmin;

  const canConfirm =
    isNominated &&
    pendingProposal &&
    Math.floor(Date.now() / 1000) >= pendingProposal.proposedAt + timelock;

  const timeRemaining = pendingProposal
    ? Math.max(0, pendingProposal.proposedAt + timelock - Math.floor(Date.now() / 1000))
    : 0;

  const handlePropose = async () => {
    if (!newAdminAddress || !publicKey) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await proposeAdmin(publicKey, newAdminAddress);
      setSuccess("Admin rotation proposed. The new admin must confirm after the timelock elapses.");
      setNewAdminAddress("");
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!publicKey) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await confirmAdmin(publicKey);
      setSuccess("Admin rotation confirmed! You are now the contract admin.");
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16">
        <p className="text-gray-400" aria-live="polite">Loading admin settings…</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
      <p className="text-gray-400 text-sm mb-8">
        Manage the StellarSplit contract admin. The admin can propose a new admin
        which can be confirmed after a {timelock / 3600}-hour timelock.
      </p>

      {error && (
        <div className="mb-6 bg-red-950/40 border border-red-800 rounded-lg px-4 py-3">
          <p role="alert" className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-950/40 border border-green-800 rounded-lg px-4 py-3">
          <p role="status" className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Current Admin */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Current Admin</h2>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
          {currentAdmin ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-gray-300 truncate" title={currentAdmin}>
                {currentAdmin}
              </span>
              {publicKey === currentAdmin && (
                <span className="text-xs font-medium text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full">
                  Connected
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Could not fetch admin address</p>
          )}
        </div>
      </section>

      {/* Pending Proposal */}
      {pendingProposal && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Pending Admin Rotation</h2>
          <div className="bg-yellow-950/30 border border-yellow-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Proposed Admin</span>
              <span className="text-sm font-mono text-gray-200 truncate ml-4" title={pendingProposal.newAdmin}>
                {truncateAddress(pendingProposal.newAdmin, 8)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Proposed At</span>
              <span className="text-sm text-gray-200">
                {new Date(pendingProposal.proposedAt * 1000).toLocaleString()}
              </span>
            </div>

            {timeRemaining > 0 ? (
              <div className="bg-yellow-950/40 rounded-lg px-3 py-2 text-sm text-yellow-300">
                Timelock remaining: {Math.floor(timeRemaining / 3600)}h{" "}
                {Math.floor((timeRemaining % 3600) / 60)}m
              </div>
            ) : (
              <p className="text-sm text-green-400">Timelock elapsed. Ready to confirm.</p>
            )}

            {canConfirm && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="mt-3 w-full min-h-11 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-semibold text-white transition-colors disabled:opacity-50"
              >
                {submitting ? "Confirming…" : "Confirm Admin Rotation"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Propose New Admin */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Propose New Admin</h2>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-3">
              Enter the Stellar address of the new admin. After proposal,
              the new admin must confirm within a {timelock / 3600}-hour timelock window.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="G... address of new admin"
                value={newAdminAddress}
                onChange={(e) => setNewAdminAddress(e.target.value)}
                className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={handlePropose}
                disabled={submitting || !newAdminAddress}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50"
              >
                {submitting ? "Proposing…" : "Propose Admin Rotation"}
              </button>
            </div>
          </div>
        </section>
      )}

      {!isAdmin && !isNominated && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-6 text-center">
          <p className="text-gray-400 text-sm">
            Connect with the current admin wallet to manage admin settings.
          </p>
        </div>
      )}
    </main>
  );
}
