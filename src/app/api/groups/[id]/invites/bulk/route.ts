/**
 * POST /api/groups/[id]/invites/bulk
 * Bulk invite contacts to a group.
 *
 * Request body:
 * {
 *   invitees: Array<{
 *     address: string;
 *     label: string;
 *     email?: string;
 *   }>
 * }
 *
 * Response:
 * {
 *   successes: Array<{ address: string; label: string; isExistingUser: boolean }>;
 *   failures: Array<{ address: string; label: string; error: string }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface InviteeData {
  address: string;
  label: string;
  email?: string;
}

interface InviteResult {
  address: string;
  label: string;
  isExistingUser: boolean;
}

interface FailedInvite {
  address: string;
  label: string;
  error: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;
    const body = await request.json();
    const invitees: InviteeData[] = body.invitees || [];

    if (!Array.isArray(invitees) || invitees.length === 0) {
      return NextResponse.json(
        { error: "No invitees provided" },
        { status: 400 }
      );
    }

    if (invitees.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 invites per action" },
        { status: 400 }
      );
    }

    const successes: InviteResult[] = [];
    const failures: FailedInvite[] = [];

    // Process each invitee
    for (const invitee of invitees) {
      try {
        // Validate Stellar address format
        if (!invitee.address || !/^G[A-Z2-7]{55}$/.test(invitee.address)) {
          failures.push({
            address: invitee.address,
            label: invitee.label,
            error: "Invalid Stellar address format",
          });
          continue;
        }

        // Check if user exists (mock implementation - in production, query user database)
        // For now, assume any address that passes validation could be an existing user
        const isExistingUser = Math.random() > 0.3; // Mock: 70% chance of existing user

        if (isExistingUser) {
          // In production, create group membership record
          successes.push({
            address: invitee.address,
            label: invitee.label,
            isExistingUser: true,
          });
        } else {
          // In production, store pending invite and send email
          // This would involve:
          // 1. Creating a pending_invite record with groupId, address, and email
          // 2. Sending an email notification using the receipt email infrastructure

          // For now, just track as successful (pending invite created)
          successes.push({
            address: invitee.address,
            label: invitee.label,
            isExistingUser: false,
          });
        }
      } catch (error) {
        failures.push({
          address: invitee.address,
          label: invitee.label,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      successes,
      failures,
    });
  } catch (error) {
    console.error("Bulk invite error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
