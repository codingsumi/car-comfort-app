/**
 * /api/auth/session
 *
 * POST  { token } — set HttpOnly admin session cookie
 * DELETE        — clear admin session cookie (logout)
 *
 * This route runs server-side only. The token is placed in an HttpOnly,
 * Secure, SameSite=Lax cookie so it is never accessible to page JS,
 * eliminating the XSS-token-theft vector that localStorage had.
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 24; // 24 hours — same typical JWT lifetime

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/** POST /api/auth/session — store token in HttpOnly cookie */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, cookieOptions(MAX_AGE));
  return res;
}

/** DELETE /api/auth/session — clear session cookie on logout */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', cookieOptions(0));
  return res;
}
