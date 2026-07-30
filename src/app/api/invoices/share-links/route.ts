import { NextRequest, NextResponse } from 'next/server';
import {
  createShareLink,
  getShareLinksForInvoice,
  revokeShareLink,
  type ShareLinkPermission,
} from '@/lib/shareLink';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';

interface CreateShareLinkRequest {
  invoiceId: string;
  permissions?: ShareLinkPermission;
  durationMs?: number;
  maxUses?: boolean;
}

interface RevokeShareLinkRequest {
  tokenHash: string;
}

/**
 * POST - Generate a new share link
 * Body: { invoiceId, permissions, durationMs, maxUses }
 */
export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = (await request.json().catch(() => null)) as CreateShareLinkRequest | null;

    if (!body?.invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const permissions: ShareLinkPermission = body.permissions || 'read';
    const durationMs = body.durationMs || 3600000; // 1 hour default
    const maxUses = body.maxUses ? 1 : undefined; // Single-use if specified

    // Validate duration
    if (durationMs < 300000 || durationMs > 2592000000) {
      // 5 minutes to 30 days
      return NextResponse.json(
        { error: 'durationMs must be between 5 minutes and 30 days' },
        { status: 400 }
      );
    }

    const shareLink = createShareLink(body.invoiceId, permissions, durationMs, maxUses);

    return NextResponse.json({
      tokenHash: shareLink.tokenHash,
      token: shareLink.token, // Return this only on creation
      invoiceId: shareLink.invoiceId,
      permissions: shareLink.permissions,
      expiresAt: shareLink.expiresAt,
      maxUses: shareLink.maxUses,
      createdAt: shareLink.createdAt,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    );
  }
}

/**
 * GET - List share links for an invoice
 * Query: invoiceId
 */
export async function GET(request: NextRequest) {
  try {
    const invoiceId = request.nextUrl.searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const links = getShareLinksForInvoice(invoiceId);

    return NextResponse.json({
      links: links.map((link) => ({
        tokenHash: link.tokenHash,
        permissions: link.permissions,
        expiresAt: link.expiresAt,
        maxUses: link.maxUses,
        usesConsumed: link.usesConsumed,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching share links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share links' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Revoke a share link
 * Body: { tokenHash }
 */
export async function DELETE(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = (await request.json().catch(() => null)) as RevokeShareLinkRequest | null;

    if (!body?.tokenHash) {
      return NextResponse.json({ error: 'tokenHash is required' }, { status: 400 });
    }

    const revoked = revokeShareLink(body.tokenHash);

    if (!revoked) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking share link:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    );
  }
}
