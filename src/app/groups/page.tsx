"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { truncateAddress } from "@stellar-split/sdk";
import { SkeletonCard } from "@/components/Skeleton";

interface ContactGroup {
  id: string;
  name: string;
  members: string[];
  lastActive: number; // ms
}

function loadGroups(): ContactGroup[] {
  try {
    return JSON.parse(localStorage.getItem("contactGroups") || "[]");
  } catch (e) {
    return [];
  }
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<ContactGroup[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    setGroups(loadGroups());
  }, []);

  const openCreate = () => {
    setName("");
    setMembers([]);
    setMemberInput("");
    setCreating(true);
  };

  const addMember = () => {
    const a = memberInput.trim();
    if (!a) return;
    if (!members.includes(a)) setMembers((m) => [...m, a]);
    setMemberInput("");
  };

  const removeMember = (addr: string) => setMembers((m) => m.filter((x) => x !== addr));

  const saveGroup = () => {
    const id = (crypto && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()));
    const g: ContactGroup = { id, name: name || `Group ${id.slice(0, 6)}`, members, lastActive: Date.now() };
    const all = loadGroups();
    const next = [g, ...all];
    localStorage.setItem("contactGroups", JSON.stringify(next));
    setGroups(next);
    setCreating(false);
  };

  if (groups === null) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Groups</h1>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Groups</h1>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">Organize contacts for recurring collaboration.</p>
        <div>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">New Group</button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">You have no groups yet.</p>
          <button onClick={openCreate} className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">New Group</button>
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:bg-gray-850 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{g.name}</h2>
                  <p className="text-sm text-gray-400">{g.members.length} member{g.members.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-sm text-gray-400 text-right">
                  <div>Last active</div>
                  <div className="font-mono text-xs">{new Date(g.lastActive).toLocaleString()}</div>
                </div>
              </div>

              {g.members.length > 0 && (
                <div className="mt-4 text-sm text-gray-400">
                  <div className="flex gap-2 flex-wrap">
                    {g.members.slice(0, 6).map((m) => (
                      <div key={m} className="px-2 py-1 bg-gray-900 rounded text-xs font-mono">{truncateAddress(m)}</div>
                    ))}
                    {g.members.length > 6 && <div className="px-2 py-1 bg-gray-900 rounded text-xs">+{g.members.length - 6} more</div>}
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">New Group</h3>
            <label className="block text-sm text-gray-300 mb-1">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mb-3" />

            <label className="block text-sm text-gray-300 mb-1">Add member address</label>
            <div className="flex gap-2 mb-3">
              <input value={memberInput} onChange={(e) => setMemberInput(e.target.value)} placeholder="G... address" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 font-mono" />
              <button onClick={addMember} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">Add</button>
            </div>

            <div className="mb-4">
              {members.length === 0 ? (
                <p className="text-gray-400 text-sm">No members yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.map((m) => (
                    <div key={m} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                      <div className="font-mono text-sm text-gray-300 truncate">{m}</div>
                      <button onClick={() => removeMember(m)} className="px-2 py-1 text-sm rounded bg-red-700 hover:bg-red-600">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg bg-gray-800">Cancel</button>
              <button onClick={saveGroup} disabled={members.length === 0} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Create</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
