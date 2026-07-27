import { NextRequest, NextResponse } from 'next/server';
import type { GroupMember, GroupLeaderboardData } from '@/types/groupLeaderboard';

// In-memory store for member opt-out preferences
// In production, this would use a database
const optOutStore = new Map<string, Set<string>>();

interface GroupInvoice {
  id: string;
  creator: string;
  recipients: Array<{ address: string; amount: bigint }>;
  funded: bigint;
  status: string;
}

// Mock function to fetch group invoices
// In production, this would query the blockchain or database
async function getGroupInvoices(groupId: string): Promise<GroupInvoice[]> {
  // TODO: Implement actual invoice fetching for the group
  // For now, return empty array
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;

    // Fetch invoices for this group
    const invoices = await getGroupInvoices(groupId);

    // Calculate member stats
    const memberStats = new Map<string, { owed: bigint; received: bigint }>();

    for (const invoice of invoices) {
      for (const recipient of invoice.recipients) {
        if (!memberStats.has(recipient.address)) {
          memberStats.set(recipient.address, { owed: 0n, received: 0n });
        }

        const stats = memberStats.get(recipient.address)!;
        stats.owed += recipient.amount;

        // Calculate received amount based on payment ratio
        if (invoice.funded > 0n) {
          const total = invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);
          const recipientShare = (recipient.amount * invoice.funded) / total;
          stats.received += recipientShare;
        }
      }
    }

    // Build leaderboard
    const members: GroupMember[] = Array.from(memberStats.entries()).map(
      ([address, stats], index) => {
        const optedOut = optOutStore.get(groupId)?.has(address) ?? false;
        const percentComplete =
          stats.owed === 0n
            ? 0
            : Math.round(Number((stats.received * 100n) / stats.owed));

        return {
          memberId: address,
          displayName: optedOut ? 'Anonymous Member' : address.slice(0, 6) + '...' + address.slice(-4),
          owedAmount: stats.owed,
          receivedAmount: stats.received,
          percentComplete,
          rank: index + 1,
          optedOut,
        };
      }
    );

    // Sort by completion percentage (descending)
    members.sort((a, b) => b.percentComplete - a.percentComplete);

    // Update ranks after sorting
    members.forEach((member, index) => {
      member.rank = index + 1;
    });

    const leaderboardData: GroupLeaderboardData = {
      groupId,
      members,
      lastUpdated: Date.now(),
    };

    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error('[Group Leaderboard API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group leaderboard' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;
    const body = await request.json();

    const { memberId, optOut } = body;

    if (!memberId || typeof optOut !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update opt-out status
    if (!optOutStore.has(groupId)) {
      optOutStore.set(groupId, new Set());
    }

    const groupOptOuts = optOutStore.get(groupId)!;

    if (optOut) {
      groupOptOuts.add(memberId);
    } else {
      groupOptOuts.delete(memberId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Group Leaderboard API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update leaderboard preferences' },
      { status: 500 }
    );
  }
}
