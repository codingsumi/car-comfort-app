/**
 * /api/auth/me  (GET)
 *
 * Server-side proxy that reads the HttpOnly admin_session cookie and
 * calls the backend GET /api/admin/profile with the token in the
 * Authorization header.  Returns { user, token } on success so the
 * client-side Zustand store can populate itself after a page refresh
 * without ever being able to read the cookie directly from JS.
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';

function backendApiUrl(): string {
  const base = String(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
  return `${base}/api`;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value?.trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${backendApiUrl()}/admin/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await res.json();

    // Return profile + token so the client can hydrate its in-memory store
    return NextResponse.json({ ok: true, user: body.data, token });
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
}
