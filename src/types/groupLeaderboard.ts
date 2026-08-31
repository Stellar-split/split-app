export interface GroupMember {
  memberId: string;
  displayName: string;
  owedAmount: bigint;
  receivedAmount: bigint;
  percentComplete: number;
  rank: number;
  optedOut: boolean;
  totalPaid: bigint;
  invoiceCount: number;
  streak: number;
}

export type LeaderboardSortBy = 'totalPaid' | 'invoiceCount' | 'streak';

export interface GroupLeaderboardData {
  groupId: string;
  members: GroupMember[];
  lastUpdated: number;
}
