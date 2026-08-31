'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import type { GroupLeaderboardData, LeaderboardSortBy } from '@/types/groupLeaderboard';

export function useGroupLeaderboard(groupId: string, sortBy: LeaderboardSortBy = 'totalPaid') {
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/leaderboard`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');

      const data = await response.json();
      if (mountedRef.current) {
        setLeaderboard(data);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    }
  };

  const updateOptOut = async (memberId: string, optOut: boolean) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/leaderboard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, optOut }),
      });

      if (!response.ok) throw new Error('Failed to update preference');

      // Refresh leaderboard data
      await fetchLeaderboard();
    } catch (err) {
      console.error('Failed to update leaderboard preference:', err);
      throw err;
    }
  };

  const mutate = fetchLeaderboard;

  const sortedLeaderboard = useMemo(() => {
    if (!leaderboard) return leaderboard;
    const members = [...leaderboard.members].sort((a, b) => {
      const diff = Number(b[sortBy]) - Number(a[sortBy]);
      return diff !== 0 ? diff : a.rank - b.rank;
    });
    return { ...leaderboard, members };
  }, [leaderboard, sortBy]);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchLeaderboard();

    // Set up polling (15-second refresh interval)
    pollIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchLeaderboard();
      }
    }, 15000);

    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [groupId]);

  return {
    leaderboard: sortedLeaderboard,
    isLoading,
    error,
    updateOptOut,
    mutate,
  };
}
