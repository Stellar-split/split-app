'use client';

import { useEffect, useState, useRef } from 'react';
import type { GroupLeaderboardData } from '@/types/groupLeaderboard';

export function useGroupLeaderboard(groupId: string) {
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
    leaderboard,
    isLoading,
    error,
    updateOptOut,
    mutate,
  };
}
