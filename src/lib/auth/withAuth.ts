import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

async function verifyJwt(
  token: string,
  secret: string
): Promise<{ sub: string; exp: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const signingInput = `${header}.${body}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Buffer.from(
      signature.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(signingInput)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    ) as { sub: string; exp: number };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export type AuthedHandler = (
  req: NextRequest,
  context: { params: Record<string, string>; account: string }
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js API route handler, requiring a valid SEP-0010 JWT
 * in the `sep10_jwt` httpOnly cookie.
 *
 * Returns 401 when the cookie is absent or the JWT is expired/invalid.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, { account }) => {
 *   return NextResponse.json({ account });
 * });
 * ```
 */
export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    const token = req.cookies.get('sep10_jwt')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token, JWT_SECRET);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(req, { ...context, account: payload.sub });
  };
}
