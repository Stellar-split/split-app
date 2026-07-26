'use client';

import React, { useState } from 'react';
import type { GroupMember } from '@/types/groupLeaderboard';
import { useGroupLeaderboard } from '@/hooks/useGroupLeaderboard';

interface GroupLeaderboardProps {
  groupId: string;
  currentUserId?: string;
}

export default function GroupLeaderboard({ groupId, currentUserId }: GroupLeaderboardProps) {
  const { leaderboard, isLoading, error, updateOptOut } = useGroupLeaderboard(groupId);
  const [togglingMember, setTogglingMember] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-gray-800 border border-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-300">Failed to load leaderboard</p>
      </div>
    );
  }

  if (!leaderboard || leaderboard.members.length === 0) {
    return (
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg text-center">
        <p className="text-gray-400">No payment activity yet for this group</p>
      </div>
    );
  }

  const handleOptOutToggle = async (member: GroupMember) => {
    setTogglingMember(member.memberId);
    try {
      await updateOptOut(member.memberId, !member.optedOut);
    } catch (err) {
      console.error('Failed to update opt-out status:', err);
    } finally {
      setTogglingMember(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Payment Leaderboard</h3>
        <p className="text-xs text-gray-400">Last updated: {new Date(leaderboard.lastUpdated).toLocaleTimeString()}</p>
      </div>

      <div className="space-y-2">
        {leaderboard.members.map((member: GroupMember) => {
          const isCurrentUser = member.memberId === currentUserId;
          const isPerfect = member.percentComplete === 100;

          return (
            <div
              key={member.memberId}
              className={`p-4 rounded-lg border transition-all ${
                isCurrentUser
                  ? 'bg-indigo-500/10 border-indigo-500/30'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white">
                  {member.rank <= 3 && !member.optedOut ? (
                    <span>{['🥇', '🥈', '🥉'][member.rank - 1]}</span>
                  ) : (
                    <span className="text-sm"># {member.rank}</span>
                  )}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-white truncate">
                      {member.optedOut ? 'Anonymous Member' : member.displayName}
                    </h4>
                    {isPerfect && !member.optedOut && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded-full font-semibold">
                        100% ✓
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        member.optedOut ? 'bg-gray-600' : 'bg-indigo-500'
                      }`}
                      style={{
                        width: `${member.percentComplete}%`,
                        opacity: member.optedOut ? 0.5 : 1,
                      }}
                    />
                  </div>

                  {/* Amount Info */}
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                    <span>
                      {member.optedOut
                        ? '(Opted out of rankings)'
                        : `Received: ${Number(member.receivedAmount) / 1e7} / ${Number(member.owedAmount) / 1e7} USDC`}
                    </span>
                  </div>
                </div>

                {/* Percentage */}
                <div className="flex-shrink-0 text-right">
                  <div className={`text-2xl font-bold ${
                    member.optedOut ? 'text-gray-500' : 'text-indigo-300'
                  }`}>
                    {member.percentComplete}%
                  </div>
                  {isCurrentUser && (
                    <p className="text-xs text-indigo-300 mt-1">You</p>
                  )}
                </div>

                {/* Opt-out Toggle */}
                {isCurrentUser && (
                  <button
                    onClick={() => handleOptOutToggle(member)}
                    disabled={togglingMember === member.memberId}
                    className="px-3 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 text-gray-300"
                    title={member.optedOut ? 'Show in rankings' : 'Hide from rankings'}
                  >
                    {member.optedOut ? 'Show' : 'Hide'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          💡 <strong>Pro tip:</strong> Click &quot;Hide&quot; to opt out of the leaderboard and your progress will show as &quot;Anonymous Member&quot; to other members.
        </p>
      </div>
    </div>
  );
}
