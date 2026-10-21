import { NextRequest, NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';

export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;
  const body = await request.json() as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
  // In a real backend this would persist to DB; for now acknowledge receipt.
  return NextResponse.json({ ok: true, marked: ids.length });
}
