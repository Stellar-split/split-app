import { NextRequest, NextResponse } from 'next/server';
import type { AddressChangeRequest, AddressChangeRequestStatus } from '@/types/addressChangeRequest';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';

// In-memory store for address change requests
// In production, this would use a database
const requestStore = new Map<string, Map<string, AddressChangeRequest>>();

function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateStellarAddress(address: string): boolean {
  return address.startsWith('G') && address.length === 56 && /^G[A-Z2-7]+$/.test(address);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;
    const requests = requestStore.get(invoiceId);

    if (!requests) {
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({
      requests: Array.from(requests.values()),
    });
  } catch (error) {
    console.error('[Address Change Requests API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address change requests' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const invoiceId = params.id;
    const body = await request.json();

    const { oldAddress, newAddress, justification } = body;

    // Validate inputs
    if (!oldAddress || !newAddress || !justification) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!validateStellarAddress(oldAddress)) {
      return NextResponse.json(
        { error: 'Invalid old address format' },
        { status: 400 }
      );
    }

    if (!validateStellarAddress(newAddress)) {
      return NextResponse.json(
        { error: 'Invalid new address format' },
        { status: 400 }
      );
    }

    if (oldAddress === newAddress) {
      return NextResponse.json(
        { error: 'New address must be different from old address' },
        { status: 400 }
      );
    }

    if (!justification.trim() || justification.trim().length < 10) {
      return NextResponse.json(
        { error: 'Justification must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Create new request
    const requestId = generateId();
    const newRequest: AddressChangeRequest = {
      id: requestId,
      invoiceId,
      recipientId: oldAddress,
      oldAddress,
      newAddress,
      justification,
      status: 'pending',
      requestedAt: Date.now(),
    };

    // Store request
    if (!requestStore.has(invoiceId)) {
      requestStore.set(invoiceId, new Map());
    }
    requestStore.get(invoiceId)!.set(requestId, newRequest);

    // TODO: Send email notification to invoice creator
    // TODO: Add to activity feed

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('[Address Change Requests API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create address change request' },
      { status: 500 }
    );
  }
}
