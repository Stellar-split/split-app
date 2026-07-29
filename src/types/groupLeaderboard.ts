export interface GroupMember {
  memberId: string;
  displayName: string;
  owedAmount: bigint;
  receivedAmount: bigint;
  percentComplete: number;
  rank: number;
  optedOut: boolean;
}

export interface GroupLeaderboardData {
  groupId: string;
  members: GroupMember[];
  lastUpdated: number;
}
