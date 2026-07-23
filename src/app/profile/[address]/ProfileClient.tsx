"use client";

import { useEffect, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";
import { getFreighterPublicKey } from "@/lib/freighter";
import Link from "next/link";

interface ReleasedInvoice {
  id: string;
  total: string;
}

interface Props {
  address: string;
  totalInvoices: number;
  totalVolume: string;
  successRate: number;
  releasedInvoices: ReleasedInvoice[];
}

const BIO_KEY = (address: string) => `stellarsplit_bio_${address}`;

export default function ProfileClient({
  address,
  totalInvoices,
  totalVolume,
  successRate,
  releasedInvoices,
}: Props) {
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(BIO_KEY(address)) ?? "";
    setBio(stored);
    setDraftBio(stored);
    getFreighterPublicKey()
      .then((pk) => setIsOwner(pk === address))
      .catch(() => null);
  }, [address]);

  const saveBio = () => {
    localStorage.setItem(BIO_KEY(address), draftBio);
    setBio(draftBio);
    setEditingBio(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${truncateAddress(address)} on StellarSplit`, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-mono break-all">
            <span className="sm:hidden">{truncateAddress(address)}</span>
            <span className="hidden sm:inline">{address}</span>
          </h1>

          {/* Bio */}
          {editingBio ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                maxLength={280}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Write a short bio…"
                aria-label="Bio"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveBio}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setDraftBio(bio); setEditingBio(false); }}
                  className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-2">
              <p className="text-gray-400 text-sm flex-1">
                {bio || (isOwner ? "No bio yet — add one!" : "No bio.")}
              </p>
              {isOwner && (
                <button
                  onClick={() => setEditingBio(true)}
                  className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  aria-label="Edit bio"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleShare}
          className="shrink-0 min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
        >
          {copied ? "Copied!" : "Share Profile"}
        </button>
      </div>

      {/* Stats */}
      <section aria-labelledby="stats-heading" className="mb-8">
        <h2 id="stats-heading" className="sr-only">Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Invoices", value: String(totalInvoices) },
            { label: "USDC Volume", value: totalVolume },
            { label: "Success Rate", value: `${successRate}%` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-gray-900 rounded-xl px-4 py-4 text-center"
            >
              <p className="text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio */}
      <section aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading" className="text-lg font-semibold mb-3">
          Completed Invoices ({releasedInvoices.length})
        </h2>
        {releasedInvoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No completed invoices yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {releasedInvoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/verify/${inv.id}`}
                  className="flex justify-between items-center bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 text-sm transition-colors"
                >
                  <span className="font-mono text-gray-300">Invoice #{inv.id}</span>
                  <span className="text-indigo-300 shrink-0">{inv.total} USDC</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
