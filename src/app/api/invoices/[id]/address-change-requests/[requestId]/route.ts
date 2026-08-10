import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
import type { AddressChangeRequestStatus } from '@/types/addressChangeRequest';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';


// Import the store (in real implementation, would use database)
// For now using a simple in-memory approach (would be shared across routes)
const requestStore = new Map<string, Map<string, any>>();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const { id: invoiceId, requestId } = params;
    const body = await request.json();

    const { status, resolvedBy } = body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Get the request
    const invoiceRequests = requestStore.get(invoiceId);
    if (!invoiceRequests) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const addressChangeRequest = invoiceRequests.get(requestId);
    if (!addressChangeRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Check if already resolved
    if (addressChangeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${addressChangeRequest.status}` },
        { status: 400 }
      );
    }

    // Update request
    addressChangeRequest.status = status;
    addressChangeRequest.resolvedAt = Date.now();
    addressChangeRequest.resolvedBy = resolvedBy || 'unknown';

    // If approved, update the invoice recipient address
    // TODO: Update invoice recipient address in blockchain/database
    // TODO: Send email notification to recipient
    // TODO: Add to activity feed

    return NextResponse.json(addressChangeRequest);
  } catch (error) {
    console.error('[Address Change Request Detail API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update address change request' },
      { status: 500 }
    );
  }
}
