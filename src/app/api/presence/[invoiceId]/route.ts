import { NextRequest, NextResponse } from 'next/server';
import type { CoCreatorPresence, PresenceHeartbeat } from '@/types/presence';

// In-memory store for presence data
// In production, this would use Redis or a database
const presenceStore = new Map<string, Map<string, CoCreatorPresence>>();
const lastHeartbeatStore = new Map<string, Map<string, number>>();

const INACTIVE_TIMEOUT = 10_000; // 10 seconds

// Helper to clean up inactive users
function cleanupInactiveUsers(invoiceId: string) {
  const roster = presenceStore.get(invoiceId);
  const heartbeats = lastHeartbeatStore.get(invoiceId);

  if (!roster || !heartbeats) return;

  const now = Date.now();
  const toDelete: string[] = [];

  heartbeats.forEach((lastHeartbeat, userId) => {
    if (now - lastHeartbeat > INACTIVE_TIMEOUT) {
      toDelete.push(userId);
    }
  });

  toDelete.forEach((userId) => {
    roster.delete(userId);
    heartbeats.delete(userId);
  });
}

// Helper to verify co-creator permissions
// In production, this would validate against actual invoice permissions
async function hasCoCreatorPermission(invoiceId: string): Promise<boolean> {
  // For now, allow all requests
  // In production: verify user has co-creator role for this invoice
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const invoiceId = params.invoiceId;

    // Cleanup inactive users
    cleanupInactiveUsers(invoiceId);

    // Get current roster
    const roster = presenceStore.get(invoiceId) || new Map();
    const active = Array.from(roster.values());

    return NextResponse.json({
      active,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Presence API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presence' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const invoiceId = params.invoiceId;

    // Verify co-creator permissions
    const hasPermission = await hasCoCreatorPermission(invoiceId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const heartbeat: PresenceHeartbeat = await request.json();

    // Validate heartbeat
    if (!heartbeat.userId || !heartbeat.displayName || !heartbeat.focusedSection) {
      return NextResponse.json(
        { error: 'Invalid heartbeat data' },
        { status: 400 }
      );
    }

    // Initialize invoice roster if needed
    if (!presenceStore.has(invoiceId)) {
      presenceStore.set(invoiceId, new Map());
      lastHeartbeatStore.set(invoiceId, new Map());
    }

    const roster = presenceStore.get(invoiceId)!;
    const heartbeats = lastHeartbeatStore.get(invoiceId)!;

    // Update presence data
    const presence: CoCreatorPresence = {
      ...heartbeat,
      lastSeen: Date.now(),
    };

    roster.set(heartbeat.userId, presence);
    heartbeats.set(heartbeat.userId, Date.now());

    // Cleanup after update
    cleanupInactiveUsers(invoiceId);

    // Return updated roster
    const active = Array.from(roster.values());

    return NextResponse.json({
      active,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Presence API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}
