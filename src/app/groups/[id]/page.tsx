"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { truncateAddress } from "@stellar-split/sdk";

interface ContactGroup {
  id: string;
  name: string;
  members: string[];
  lastActive: number;
}

function loadGroups(): ContactGroup[] {
  try {
    return JSON.parse(localStorage.getItem("contactGroups") || "[]");
  } catch (e) {
    return [];
  }
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<ContactGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const g = loadGroups().find((x) => x.id === groupId) || null;
    setGroup(g);
    setLoading(false);
  }, [groupId]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="h-8 bg-gray-800 rounded mb-4" />
      </main>
    );
  }

  if (!group) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/groups" className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block">&larr; Back to groups</Link>
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-gray-400 mb-4">Group not found.</p>
          <Link href="/groups" className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">Back to groups</Link>
        </div>
      </main>
    );
  }

  const handleCreateInvoice = () => {
    const recipients = group.members.map((a) => ({ address: a, amount: "" }));
    const template = { recipients, deadlineDays: 7, token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "" };
    try {
      sessionStorage.setItem("invoiceTemplate", JSON.stringify(template));
    } catch (e) {
      console.error("Failed to set invoice template", e);
    }
    router.push("/invoice/new");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <Link href="/groups" className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block">&larr; Back to groups</Link>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{group.name}</h1>
            <p className="text-sm text-gray-400">{group.members.length} member{group.members.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-sm text-gray-400 text-right">
            <div>Last active</div>
            <div className="font-mono text-xs">{new Date(group.lastActive).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Members</h2>
          <div>
            <button onClick={handleCreateInvoice} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">Create Invoice for Group</button>
          </div>
        </div>

        {group.members.length === 0 ? (
          <p className="text-gray-400">No members in this group.</p>
        ) : (
          <div className="grid gap-3">
            {group.members.map((m) => (
              <div key={m} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
                <div className="font-mono truncate">{m}</div>
                <div className="text-xs text-gray-400">{truncateAddress(m)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
