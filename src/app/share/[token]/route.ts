import { NextRequest, NextResponse } from 'next/server';
import {
  validateShareLink,
  incrementShareLinkUse,
  hashToken,
} from '@/lib/shareLink';

/**
 * GET - Validate and access a shared invoice
 * Returns: Invoice data or redirect based on permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid share link' },
        { status: 404 }
      );
    }

    const validation = validateShareLink(token);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Share link not available',
          reason: validation.reason,
        },
        { status: 404 }
      );
    }

    const { link, permission } = validation;

    // Increment usage counter
    incrementShareLinkUse(hashToken(token));

    // Create a session cookie or token for this session
    // The response includes the invoice data and permission scope
    const response = NextResponse.json({
      invoiceId: link.invoiceId,
      permission,
      expiresAt: link.expiresAt,
      accessGrantedAt: new Date(),
    });

    // Set a secure, HTTP-only cookie for this session
    // This cookie grants temporary access to the invoice
    response.cookies.set({
      name: 'share_session',
      value: JSON.stringify({
        invoiceId: link.invoiceId,
        permission,
        expiresAt: link.expiresAt.toISOString(),
        accessGrantedAt: new Date().toISOString(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    return response;
  } catch (error) {
    console.error('Error accessing shared invoice:', error);
    return NextResponse.json(
      { error: 'Failed to access share link' },
      { status: 500 }
    );
  }
}

/**
 * HEAD - Check if share link is valid without incrementing uses
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid share link' },
        { status: 404 }
      );
    }

    const validation = validateShareLink(token);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Share link not available',
          reason: validation.reason,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error validating shared invoice:', error);
    return NextResponse.json(
      { error: 'Failed to validate share link' },
      { status: 500 }
    );
  }
}
