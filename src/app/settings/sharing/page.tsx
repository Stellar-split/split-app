"use client";

import { useEffect, useState } from "react";
import { getFreighterPublicKey } from "@/lib/freighter";
import SharePermissionsPanel from "@/components/SharePermissionsPanel";

export default function SharingSettingsPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then((pk) => (pk ? setAddress(pk) : setError("Connect your wallet to manage shared access.")))
      .catch(() => setError("Connect your wallet to manage shared access."));
  }, []);

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Sharing & permissions</h1>
      <p className="text-gray-400 mb-8">
        Control who can view, comment on, edit, or manage your invoices.
      </p>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {address && <SharePermissionsPanel resourceId={`account:${address}`} currentAddress={address} />}
    </main>
  );
}
