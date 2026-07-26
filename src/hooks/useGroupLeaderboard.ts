'use client';

import useSWR from 'swr';
import type { GroupLeaderboardData } from '@/types/groupLeaderboard';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useGroupLeaderboard(groupId: string) {
  const { data, error, isLoading, mutate } = useSWR<GroupLeaderboardData>(
    `/api/groups/${groupId}/leaderboard`,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 15000, // 15-second refresh interval
    }
  );

  const updateOptOut = async (memberId: string, optOut: boolean) => {
    try {
      await fetch(`/api/groups/${groupId}/leaderboard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, optOut }),
      });

      // Refresh leaderboard data
      mutate();
    } catch (err) {
      console.error('Failed to update leaderboard preference:', err);
      throw err;
    }
  };

  return {
    leaderboard: data,
    isLoading,
    error,
    updateOptOut,
    mutate,
  };
}
